import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jsPDF } from 'jspdf';
import { customFetch } from '../api/http';
import { useAuthStore } from '../store/auth';
import WorkspaceCanvas, { type CanvasElementProps } from '../components/WorkspaceCanvas';

type ExportFormat = 'png' | 'jpg' | 'svg' | 'pdf';

type EditorSnapshot = {
    title: string;
    canvasWidth: number;
    canvasHeight: number;
    canvasBgColor: string;
    elements: CanvasElementProps[];
};

const cloneElements = (value: CanvasElementProps[]) => JSON.parse(JSON.stringify(value)) as CanvasElementProps[];
const serializeEditorSnapshot = (snapshot: EditorSnapshot) => JSON.stringify(snapshot);

const escapeXml = (value: unknown) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const createSafeFilename = (value: string) => {
    const cleaned = value
        .trim()
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, '_')
        .replace(/\.+$/g, '');

    return cleaned || 'project';
};

const formatNumber = (value: number) => Number.isFinite(value) ? Number(value.toFixed(2)) : 0;

const buildTrianglePoints = (x: number, y: number, width: number, height: number) => {
    const top = `${formatNumber(x + width / 2)},${formatNumber(y)}`;
    const left = `${formatNumber(x)},${formatNumber(y + height)}`;
    const right = `${formatNumber(x + width)},${formatNumber(y + height)}`;
    return `${top} ${left} ${right}`;
};

const buildStarPoints = (centerX: number, centerY: number, outerRadius: number, innerRadius: number, points = 5) => {
    const vertices = [];
    const step = Math.PI / points;

    for (let index = 0; index < points * 2; index += 1) {
        const radius = index % 2 === 0 ? outerRadius : innerRadius;
        const angle = -Math.PI / 2 + index * step;
        vertices.push(`${formatNumber(centerX + Math.cos(angle) * radius)},${formatNumber(centerY + Math.sin(angle) * radius)}`);
    }

    return vertices.join(' ');
};

const buildSvgMarkup = (params: {
    width: number;
    height: number;
    backgroundColor: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    elements: any[];
}) => {
    const { width, height, backgroundColor, elements } = params;
    const content = elements.map((element) => {
        if (!element?.type) return '';

        if (element.type === 'text') {
            const text = String(element.text ?? '');
            const fontSize = Number(element.fontSize ?? 32);
            const x = Number(element.x ?? 0);
            const y = Number(element.y ?? 0);
            const widthValue = Number(element.width ?? 0);
            const fontFamily = escapeXml(element.fontFamily ?? 'Arial');
            const fontStyle = element.fontStyle?.includes('italic') ? 'italic' : 'normal';
            const fontWeight = element.fontStyle?.includes('bold') ? '700' : '400';
            const textDecoration = element.textDecoration || 'none';
            const fill = escapeXml(element.fill ?? '#000000');
            const align = element.align === 'center' ? 'middle' : element.align === 'right' ? 'end' : 'start';
            const textX = align === 'middle' ? x + widthValue / 2 : align === 'end' ? x + widthValue : x;
            const lines = text.split('\n');
            const lineHeight = fontSize * 1.2;

            return `
                <text x="${formatNumber(textX)}" y="${formatNumber(y)}" fill="${fill}" font-family="${fontFamily}" font-size="${formatNumber(fontSize)}" font-style="${fontStyle}" font-weight="${fontWeight}" text-decoration="${textDecoration}" text-anchor="${align}" xml:space="preserve">
                    ${lines.map((line, index) => `<tspan x="${formatNumber(textX)}" dy="${index === 0 ? 0 : formatNumber(lineHeight)}">${escapeXml(line || ' ')}</tspan>`).join('')}
                </text>
            `;
        }

        if (element.type === 'image') {
            const x = Number(element.x ?? 0);
            const y = Number(element.y ?? 0);
            const widthValue = Number(element.width ?? 100);
            const heightValue = Number(element.height ?? 100);
            const src = escapeXml(element.src ?? '');

            if (!src) return '';

            return `
                <image href="${src}" x="${formatNumber(x)}" y="${formatNumber(y)}" width="${formatNumber(widthValue)}" height="${formatNumber(heightValue)}" preserveAspectRatio="none" />
            `;
        }

        if (element.type === 'shape') {
            const fill = escapeXml(element.fill ?? '#cbd5e1');
            const x = Number(element.x ?? 0);
            const y = Number(element.y ?? 0);
            const widthValue = Number(element.width ?? element.baseWidth ?? 150);
            const heightValue = Number(element.height ?? element.baseHeight ?? 150);

            if (element.shapeType === 'rect') {
                const cornerRadius = Number(element.cornerRadius ?? 0);
                return `<rect x="${formatNumber(x)}" y="${formatNumber(y)}" width="${formatNumber(widthValue)}" height="${formatNumber(heightValue)}" rx="${formatNumber(cornerRadius)}" ry="${formatNumber(cornerRadius)}" fill="${fill}" />`;
            }

            if (element.shapeType === 'ellipse') {
                return `<ellipse cx="${formatNumber(x + widthValue / 2)}" cy="${formatNumber(y + heightValue / 2)}" rx="${formatNumber(widthValue / 2)}" ry="${formatNumber(heightValue / 2)}" fill="${fill}" />`;
            }

            if (element.shapeType === 'triangle') {
                return `<polygon points="${buildTrianglePoints(x, y, widthValue, heightValue)}" fill="${fill}" />`;
            }

            if (element.shapeType === 'star') {
                const outerRadius = Math.max(5, Math.min(widthValue, heightValue) / 2);
                const innerRadius = Number(element.innerRadius ?? outerRadius * 0.45);
                const points = Number(element.numPoints ?? 5);
                return `<polygon points="${buildStarPoints(x + widthValue / 2, y + heightValue / 2, outerRadius, innerRadius, points)}" fill="${fill}" />`;
            }
        }

        if (element.type === 'line') {
            const points = Array.isArray(element.points) ? element.points : [];
            if (points.length < 4) return '';

            const strokeColor = escapeXml(element.tool === 'eraser' ? backgroundColor : (element.stroke ?? '#000000'));
            const strokeWidth = Number(element.strokeWidth ?? 5);
            const dashArray = Array.isArray(element.dash) && element.dash.length > 0 ? ` stroke-dasharray="${element.dash.join(' ')}"` : '';
            const pathPoints = (points as number[]).reduce((acc: string[], point: number, index: number) => {
                if (index % 2 === 0) {
                    acc.push(`${formatNumber(point)},${formatNumber(points[index + 1] ?? point)}`);
                }
                return acc;
            }, []).join(' ');

            if (element.tool === 'arrow') {
                return `<polyline points="${pathPoints}" fill="none" stroke="${strokeColor}" stroke-width="${formatNumber(strokeWidth)}" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#arrowhead)"${dashArray} />`;
            }

            return `<polyline points="${pathPoints}" fill="none" stroke="${strokeColor}" stroke-width="${formatNumber(strokeWidth)}" stroke-linecap="round" stroke-linejoin="round"${dashArray} />`;
        }

        return '';
    }).join('');

    return `
        <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${formatNumber(width)}" height="${formatNumber(height)}" viewBox="0 0 ${formatNumber(width)} ${formatNumber(height)}" shape-rendering="geometricPrecision">
            <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L10,3.5 L0,7 Z" fill="#000000" />
                </marker>
            </defs>
            <rect width="100%" height="100%" fill="${escapeXml(backgroundColor)}" />
            ${content}
        </svg>
    `;
};

export default function Editor() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const user = useAuthStore(s => s.user);
    const fileInputRef = useRef<HTMLInputElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stageRef = useRef<any>(null);

    const [title, setTitle] = useState('Loading...');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const [canvasWidth, setCanvasWidth] = useState(800);
    const [canvasHeight, setCanvasHeight] = useState(600);
    const [canvasBgColor, setCanvasBgColor] = useState('#ffffff');
    const [showGrid, setShowGrid] = useState(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [elements, setElements] = useState<any[]>([]);

    const [showFiltersMenu, setShowFiltersMenu] = useState(false);

    const FILTERS_LIST = [
        { name: 'None', filter: null, previewClass: '' },
        { name: 'Grayscale', filter: 'Grayscale', previewClass: 'filter-grayscale' },
        { name: 'Sepia', filter: 'Sepia', previewClass: 'filter-sepia' },
        { name: 'Invert', filter: 'Invert', previewClass: 'filter-invert' },
        { name: 'Blur', filter: 'Blur', previewClass: 'filter-blur' },
        { name: 'Bright', filter: 'Brighten', previewClass: 'filter-bright' },
    ];

    const SYSTEM_IMAGES = [
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=200&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=200&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=200&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=200&auto=format&fit=crop'
    ];

    const [showShapesMenu, setShowShapesMenu] = useState(false);
    const [showDrawMenu, setShowDrawMenu] = useState(false);
    const [showHistoryMenu, setShowHistoryMenu] = useState(false);
    const [showTemplateMenu, setShowTemplateMenu] = useState(false);
    const [templateMessage, setTemplateMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null);
    const [historyMessage, setHistoryMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null);
    const [showImageMenu, setShowImageMenu] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const loadedProjectIdRef = useRef<number | null>(null);
    const saveLockRef = useRef(false);

    const [mode, setMode] = useState<'select' | 'draw'>('select');
    const [drawTool, setDrawTool] = useState<'pen' | 'marker' | 'eraser' | 'line' | 'arrow' | 'dashed'>('pen');
    const [drawColor, setDrawColor] = useState('#000000');
    const [drawSize, setDrawSize] = useState(5);

    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [showExitModal, setShowExitModal] = useState(false);
    const isProgrammaticUpdate = useRef(true);
    const isHistoryReplaying = useRef(false);
    const undoStackRef = useRef<EditorSnapshot[]>([]);
    const redoStackRef = useRef<EditorSnapshot[]>([]);
    const lastSnapshotRef = useRef('');
    const savedSnapshotRef = useRef('');

    const createEditorSnapshot = useCallback((): EditorSnapshot => ({
        title,
        canvasWidth,
        canvasHeight,
        canvasBgColor,
        elements: cloneElements(elements),
    }), [title, canvasWidth, canvasHeight, canvasBgColor, elements]);

    const applyEditorSnapshot = useCallback((snapshot: EditorSnapshot, options?: { markAsSaved?: boolean }) => {
        isProgrammaticUpdate.current = true;
        isHistoryReplaying.current = true;

        setTitle(snapshot.title);
        setCanvasWidth(snapshot.canvasWidth);
        setCanvasHeight(snapshot.canvasHeight);
        setCanvasBgColor(snapshot.canvasBgColor);
        setElements(cloneElements(snapshot.elements));
        setSelectedId(null);
        setMode('select');

        const snapshotSignature = serializeEditorSnapshot(snapshot);
        lastSnapshotRef.current = snapshotSignature;

        if (options?.markAsSaved) {
            savedSnapshotRef.current = snapshotSignature;
        }

        window.setTimeout(() => {
            isProgrammaticUpdate.current = false;
            isHistoryReplaying.current = false;
            setHasUnsavedChanges(lastSnapshotRef.current !== savedSnapshotRef.current);
        }, 0);
    }, []);

    useEffect(() => {
        if (isProgrammaticUpdate.current) return;
        setHasUnsavedChanges(true);
    }, [elements, title, canvasWidth, canvasHeight, canvasBgColor]);

    useEffect(() => {
        if (isProgrammaticUpdate.current || isHistoryReplaying.current) return;

        const currentSnapshot = createEditorSnapshot();
        const currentSignature = serializeEditorSnapshot(currentSnapshot);

        if (lastSnapshotRef.current && lastSnapshotRef.current !== currentSignature) {
            undoStackRef.current.push(JSON.parse(lastSnapshotRef.current) as EditorSnapshot);
            if (undoStackRef.current.length > 50) {
                undoStackRef.current.shift();
            }
            redoStackRef.current = [];
        }

        lastSnapshotRef.current = currentSignature;
        setHasUnsavedChanges(currentSignature !== savedSnapshotRef.current);
    }, [title, canvasWidth, canvasHeight, canvasBgColor, elements, createEditorSnapshot]);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden' && hasUnsavedChanges) {

                const currentCanvasData = {
                    className: 'Stage',
                    aattrs: {
                        backgroundColor: canvasBgColor,
                        width: canvasWidth,
                        height: canvasHeight
                    },
                    children: elements.filter(el => el.type !== 'placeholder')
                };

                fetch(`/api/project/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: title,
                        width: canvasWidth,
                        height: canvasHeight,
                        canvasData: currentCanvasData
                    }),
                    keepalive: true
                }).catch(err => console.error('Emergency save failed:', err));
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [hasUnsavedChanges, title, canvasWidth, canvasHeight, canvasBgColor, elements, id]);

    // Обробник натискання кнопки "Back"
    const handleExitClick = () => {
        if (hasUnsavedChanges) {
            setShowExitModal(true);
        } else {
            navigate('/home');
        }
    };

    const applyProjectState = useCallback((projectData: {
        id: number;
        title?: string;
        width?: number;
        height?: number;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        canvasData?: any;
    }) => {
        const parsedCanvas = typeof projectData.canvasData === 'string'
            ? JSON.parse(projectData.canvasData)
            : projectData.canvasData;

        applyEditorSnapshot({
            title: projectData.title || 'Untitled Design',
            canvasWidth: projectData.width || parsedCanvas?.attrs?.width || 800,
            canvasHeight: projectData.height || parsedCanvas?.attrs?.height || 600,
            canvasBgColor: parsedCanvas?.attrs?.backgroundColor || '#ffffff',
            elements: Array.isArray(parsedCanvas?.children) ? parsedCanvas.children : [],
        }, { markAsSaved: true });

        loadedProjectIdRef.current = projectData.id;

        undoStackRef.current = [];
        redoStackRef.current = [];
    }, [applyEditorSnapshot]);

    const { data: project, isLoading, isError } = useQuery({
        queryKey: ['project', id],
        queryFn: async () => {
            const response = await customFetch(`/api/project/${id}`);
            if (!response.ok) throw new Error('Project not found');
            return response.json();
        },
        enabled: !!id && id !== 'new',
    });

    const {
        data: historyVersions = [],
        isLoading: isHistoryLoading,
        isError: isHistoryError,
    } = useQuery({
        queryKey: ['project-history', id],
        queryFn: async () => {
            const response = await customFetch(`/api/project/${id}/version`);
            if (!response.ok) throw new Error('Failed to load history');
            return response.json() as Promise<Array<{
                id: number;
                version: number;
                thumbnail_url: string | null;
                created_at: string;
            }>>;
        },
        enabled: !!id && id !== 'new' && showHistoryMenu,
    });

    const { data: projectAssets = [], isLoading: isAssetsLoading } = useQuery({
        queryKey: ['project-assets', id],
        queryFn: async () => {
            const response = await customFetch(`/api/project/${id}/assets`);
            if (!response.ok) throw new Error('Failed to load assets');
            return response.json();
        },
        enabled: !!id && id !== 'new' && showImageMenu,
    });

    useEffect(() => {
        if (project && loadedProjectIdRef.current !== project.id) {
            applyProjectState(project);
        }
    }, [project, applyProjectState]);

    useEffect(() => {
        if (!showExportMenu) return;

        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (!target?.closest('[data-export-menu]')) {
                setShowExportMenu(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [showExportMenu]);

    useEffect(() => {
        if (!historyMessage) return;

        const timeout = setTimeout(() => setHistoryMessage(null), 3000);
        return () => clearTimeout(timeout);
    }, [historyMessage]);

    const uploadAssetMutation = useMutation({
        mutationFn: async ({ formData, tempId, w, h }: { formData: FormData, tempId: string, w: number, h: number }) => {
            const response = await customFetch(`/api/project/${id}/assets`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error('Failed to upload image');
            const data = await response.json();
            return { ...data, tempId, shrinkW: w, shrinkH: h };
        },
        onSuccess: (result) => {
            setElements((prev) => prev.map(el => {
                if (el.id === result.tempId) {
                    return {
                        id: result.tempId,
                        type: 'image',
                        src: result.url,
                        cloudinaryId: result.public_id,
                        x: el.x,
                        y: el.y,
                        width: result.shrinkW,
                        height: result.shrinkH,
                        rotation: 0
                    };
                }
                return el;
            }));

            setMode('select');
            setSelectedId(result.tempId);
            if (fileInputRef.current) fileInputRef.current.value = '';

            queryClient.invalidateQueries({ queryKey: ['project-assets', id] });
        },
        onError: (err, variables) => {
            console.error(err);
            setElements((prev) => prev.map(el => el.id === variables.tempId ? { ...el, status: 'error', message: 'Upload failed' } : el));
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const tempId = Date.now().toString();
        const maxSize = 10 * 1024 * 1024;
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

        if (file.size > maxSize || !validTypes.includes(file.type)) {
            setElements((prev) => [...prev, { id: tempId, type: 'placeholder', status: 'error', message: file.size > maxSize ? 'Max size 10MB' : 'Invalid format', x: 100, y: 100, width: 200, height: 200 }]);
            setMode('select');
            setSelectedId(tempId);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        const imgUrl = URL.createObjectURL(file);
        const img = new window.Image();

        img.onload = () => {
            let w = img.width;
            let h = img.height;
            const maxDim = 400;

            if (w > maxDim || h > maxDim) {
                const ratio = Math.min(maxDim / w, maxDim / h);
                w = w * ratio;
                h = h * ratio;
            }

            setElements((prev) => [...prev, {
                id: tempId, type: 'placeholder', status: 'loading',
                x: 100, y: 100, width: w, height: h
            }]);

            setMode('select');
            setSelectedId(tempId);
            setShowImageMenu(false);

            const formData = new FormData();
            formData.append('file', file);

            uploadAssetMutation.mutate({ formData, tempId, w, h });

            URL.revokeObjectURL(imgUrl);
        };
        img.src = imgUrl;
    };

    const tempImageIdRef = useRef(0);

    const handleImageClick = () => {
        fileInputRef.current?.click();
    };

    const handleAddExistingImage = (url: string) => {
        tempImageIdRef.current += 1;
        const tempId = `image-${tempImageIdRef.current}`;
        const img = new window.Image();

        img.onload = () => {
            let w = img.width;
            let h = img.height;
            const maxDim = 400;

            if (w > maxDim || h > maxDim) {
                const ratio = Math.min(maxDim / w, maxDim / h);
                w = w * ratio;
                h = h * ratio;
            }

            setElements((prev) => [...prev, {
                id: tempId,
                type: 'image',
                src: url,
                x: 100,
                y: 100,
                width: w,
                height: h,
                rotation: 0
            }]);

            setMode('select');
            setSelectedId(tempId);
            setShowImageMenu(false);
        };
        img.src = url;
    };

    const handleAddText = () => {
        const newText = {
            id: Date.now().toString(),
            type: 'text',
            text: 'Double click to edit',
            x: 100,
            y: 100,
            fontSize: 32,
            fill: '#000000',
            width: 300,
        };

        setElements((prev) => [...prev, newText]);
        setMode('select');
        setSelectedId(newText.id);
    };

    const handleAddShape = (shapeType: 'rect' | 'ellipse' | 'triangle' | 'star') => {
        const baseShape = {
            id: Date.now().toString(),
            type: 'shape',
            shapeType: shapeType,
            x: 150,
            y: 150,
            width: 150,
            height: 150,
            fill: '#cbd5e1',
        };

        let shapeDetails = {};

        if (shapeType === 'rect') {
            shapeDetails = { cornerRadius: 0 };
        } else if (shapeType === 'triangle') {
            shapeDetails = { sides: 3 };
        } else if (shapeType === 'star') {
            shapeDetails = { numPoints: 5, innerRadius: 35 };
        }

        const newShape = { ...baseShape, ...shapeDetails };

        setElements((prev) => [...prev, newShape]);
        setMode('select');
        setSelectedId(newShape.id);
        setShowShapesMenu(false);
    };

    const saveMutation = useMutation({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mutationFn: async (updateData: { title: string; width: number; height: number; bgColor: string; elements: any[]; thumbnailDataUrl?: string }) => {
            const currentCanvasData = typeof project.canvasData === 'string'
                ? JSON.parse(project.canvasData)
                : JSON.parse(JSON.stringify(project?.canvasData || { className: 'Stage', attrs: {}, children: [] }));

            currentCanvasData.attrs = {
                ...currentCanvasData.attrs,
                backgroundColor: updateData.bgColor,
                width: updateData.width,
                height: updateData.height
            };

            currentCanvasData.children = updateData.elements;

            if (updateData.thumbnailDataUrl) {
                const thumbnailBlob = await (await fetch(updateData.thumbnailDataUrl)).blob();
                const thumbnailFile = new File([thumbnailBlob], 'thumbnail.jpg', {
                    type: thumbnailBlob.type || 'image/jpeg',
                });

                const thumbnailFormData = new FormData();
                thumbnailFormData.append('file', thumbnailFile);

                const thumbnailResponse = await customFetch(`/api/project/${id}`, {
                    method: 'PATCH',
                    body: thumbnailFormData,
                });

                if (!thumbnailResponse.ok) {
                    const thumbErrData = await thumbnailResponse.json().catch(() => ({}));
                    console.error('Thumbnail save error:', thumbErrData);
                }
            }

            const response = await customFetch(`/api/project/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: updateData.title,
                    width: updateData.width,
                    height: updateData.height,
                    canvasData: currentCanvasData,
                }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                console.error("Backend Error:", errData);
                throw new Error('Failed to save project');
            }

            return response.json();
        },
        onSuccess: () => {
            setHasUnsavedChanges(false);
            savedSnapshotRef.current = serializeEditorSnapshot(createEditorSnapshot());
            queryClient.invalidateQueries({ queryKey: ['project', id] });
            queryClient.invalidateQueries({ queryKey: ['project-history', id] });
        },
        onSettled: () => {
            saveLockRef.current = false;
        }
    });

    const saveAsTemplateMutation = useMutation({
        mutationFn: async () => {
            const currentCanvasData = typeof project.canvasData === 'string'
                ? JSON.parse(project.canvasData)
                : JSON.parse(JSON.stringify(project?.canvasData || { className: 'Stage', attrs: {}, children: [] }));

            currentCanvasData.attrs = {
                ...currentCanvasData.attrs,
                backgroundColor: canvasBgColor,
                width: canvasWidth,
                height: canvasHeight
            };

            currentCanvasData.children = elements;

            const response = await customFetch(`/api/project/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title,
                    width: canvasWidth,
                    height: canvasHeight,
                    canvasData: currentCanvasData,
                    isTemplate: true
                }),
            });

            if (!response.ok) throw new Error('Failed to save as template');
            return response.json();
        },
        onSuccess: () => {
            setTemplateMessage({ text: 'Successfully saved!', type: 'success' });
            queryClient.invalidateQueries({ queryKey: ['project', id] });

            setTimeout(() => {
                setTemplateMessage(null);
            }, 3000);
        },
        onError: () => {
            setTemplateMessage({ text: 'Save error', type: 'error' });

            setTimeout(() => {
                setTemplateMessage(null);
            }, 3000);
        }
    });

    const restoreVersionMutation = useMutation({
        mutationFn: async (historyId: number) => {
            const response = await customFetch(`/api/project/${id}/restore-version`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ historyId }),
            });

            if (!response.ok) {
                throw new Error('Failed to restore version');
            }

            return response.json() as Promise<{
                id: number;
                title?: string;
                width?: number;
                height?: number;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                canvasData?: any;
            }>;
        },
        onSuccess: (restoredProject) => {
            applyProjectState(restoredProject);
            setHistoryMessage({ text: 'Version restored', type: 'success' });
            queryClient.invalidateQueries({ queryKey: ['project', id] });
            queryClient.invalidateQueries({ queryKey: ['project-history', id] });
        },
        onError: () => {
            setHistoryMessage({ text: 'Failed to restore version', type: 'error' });
        },
    });

    const formatHistoryDate = (date: string) => {
        return new Date(date).toLocaleString([], {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const downloadBlob = (blob: Blob, filename: string) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
    };

    const captureStageCanvas = () => {
        if (!stageRef.current) return undefined;

        const transformer = stageRef.current.findOne('Transformer');
        const previousVisible = transformer?.visible?.();

        try {
            if (transformer) {
                transformer.visible(false);
                transformer.getLayer()?.batchDraw();
            }

            const stageCanvas = stageRef.current.toCanvas({
                pixelRatio: 2,
                x: 0,
                y: 0,
                width: canvasWidth,
                height: canvasHeight,
            });

            const composedCanvas = document.createElement('canvas');
            composedCanvas.width = stageCanvas.width;
            composedCanvas.height = stageCanvas.height;

            const context = composedCanvas.getContext('2d');
            if (!context) return undefined;

            context.fillStyle = canvasBgColor;
            context.fillRect(0, 0, composedCanvas.width, composedCanvas.height);
            context.drawImage(stageCanvas, 0, 0);

            return composedCanvas;
        } finally {
            if (transformer) {
                transformer.visible(previousVisible ?? true);
                transformer.getLayer()?.batchDraw();
            }
        }
    };

    const exportCanvasAsImage = async (format: 'png' | 'jpg') => {
        const exportCanvas = captureStageCanvas();
        if (!exportCanvas) {
            throw new Error('Canvas is not ready for export');
        }

        const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
        const quality = format === 'jpg' ? 0.92 : undefined;

        const blob = await new Promise<Blob>((resolve, reject) => {
            exportCanvas.toBlob((result) => {
                if (!result) {
                    reject(new Error('Failed to export image'));
                    return;
                }

                resolve(result);
            }, mimeType, quality);
        });

        downloadBlob(blob, `${createSafeFilename(title)}.${format}`);
    };

    const exportCanvasAsSvg = () => {
        const svgMarkup = buildSvgMarkup({
            width: canvasWidth,
            height: canvasHeight,
            backgroundColor: canvasBgColor,
            elements,
        });

        const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
        downloadBlob(blob, `${createSafeFilename(title)}.svg`);
    };

    const exportCanvasAsPdf = async () => {
        const exportCanvas = captureStageCanvas();
        if (!exportCanvas) {
            throw new Error('Canvas is not ready for export');
        }

        const dataUrl = exportCanvas.toDataURL('image/png');
        const orientation = canvasWidth >= canvasHeight ? 'landscape' : 'portrait';
        const pdf = new jsPDF({
            orientation,
            unit: 'px',
            format: [canvasWidth, canvasHeight],
            compress: true,
        });

        pdf.addImage(dataUrl, 'PNG', 0, 0, canvasWidth, canvasHeight);
        pdf.save(`${createSafeFilename(title)}.pdf`);
    };

    const handleExport = async (format: ExportFormat) => {
        if (isExporting) return;

        setIsExporting(true);
        setShowExportMenu(false);

        try {
            if (format === 'png' || format === 'jpg') {
                await exportCanvasAsImage(format);
            } else if (format === 'svg') {
                exportCanvasAsSvg();
            } else {
                await exportCanvasAsPdf();
            }
        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    const visibleHistoryVersions = historyVersions.filter((version) => Boolean(version.thumbnail_url));

    const generateThumbnailDataUrl = () => {
        if (!stageRef.current) return undefined;

        try {
            const exportWidth = 360;
            const maxSide = Math.max(canvasWidth, canvasHeight);
            const pixelRatio = Math.max(0.2, Math.min(1, exportWidth / maxSide));

            const stageCanvas = stageRef.current.toCanvas({
                pixelRatio,
                x: 0,
                y: 0,
                width: canvasWidth,
                height: canvasHeight,
            });

            const composedCanvas = document.createElement('canvas');
            composedCanvas.width = stageCanvas.width;
            composedCanvas.height = stageCanvas.height;

            const context = composedCanvas.getContext('2d');
            if (!context) return undefined;

            context.fillStyle = canvasBgColor;
            context.fillRect(0, 0, composedCanvas.width, composedCanvas.height);
            context.drawImage(stageCanvas, 0, 0);

            return composedCanvas.toDataURL('image/jpeg', 0.82);
        } catch (error) {
            console.warn('Failed to generate thumbnail', error);
            return undefined;
        }
    };

    const handleSave = () => {
        if (saveLockRef.current || saveMutation.isPending) {
            return;
        }

        saveLockRef.current = true;
        const thumbnailDataUrl = generateThumbnailDataUrl();
        saveMutation.mutate({
            title,
            width: canvasWidth,
            height: canvasHeight,
            bgColor: canvasBgColor,
            elements,
            thumbnailDataUrl,
        });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateSelectedElement = (key: string, value: any) => {
        setElements(elements.map(el => el.id === selectedId ? { ...el, [key]: value } : el));
    };

    const flipSelectedElement = (axis: 'x' | 'y') => {
        if (!selectedId) return;

        setElements((prev) => prev.map((el) => {
            if (el.id !== selectedId) return el;

            if (el.type === 'line') {
                const points: number[] = Array.isArray(el.points) ? (el.points as number[]) : [];
                if (points.length < 4) return el;

                const xValues: number[] = [];
                const yValues: number[] = [];

                for (let index = 0; index < points.length; index += 2) {
                    xValues.push(Number(points[index]));
                    yValues.push(Number(points[index + 1]));
                }

                const minX = Math.min(...xValues);
                const maxX = Math.max(...xValues);
                const minY = Math.min(...yValues);
                const maxY = Math.max(...yValues);

                const mirroredPoints = points.map((point: number, index: number) => {
                    if (index % 2 === 0) {
                        return axis === 'x' ? minX + maxX - Number(point) : Number(point);
                    }

                    return axis === 'y' ? minY + maxY - Number(point) : Number(point);
                });

                return { ...el, points: mirroredPoints };
            }

            const currentScaleX = typeof el.scaleX === 'number' && el.scaleX !== 0 ? el.scaleX : 1;
            const currentScaleY = typeof el.scaleY === 'number' && el.scaleY !== 0 ? el.scaleY : 1;

            if (axis === 'x') {
                return { ...el, scaleX: -currentScaleX };
            }

            return { ...el, scaleY: -currentScaleY };
        }));
    };

    const selectedElementIndex = elements.findIndex(el => el.id === selectedId);

    const getLayerLabel = (element?: { type?: string; text?: string; shapeType?: string; tool?: string }) => {
        if (!element?.type) return 'Element';

        if (element.type === 'text') {
            const previewText = (element.text || 'Text').replace(/\s+/g, ' ').trim();
            return previewText.length > 20 ? `${previewText.slice(0, 20)}...` : previewText;
        }

        if (element.type === 'shape') {
            return element.shapeType ? `${element.shapeType.charAt(0).toUpperCase()}${element.shapeType.slice(1)} shape` : 'Shape';
        }

        if (element.type === 'image') return 'Image';

        if (element.type === 'line') {
            if (element.tool === 'eraser') return 'Eraser stroke';
            if (element.tool === 'arrow') return 'Arrow';
            if (element.tool === 'dashed') return 'Dashed line';
            return 'Line';
        }

        return element.type.charAt(0).toUpperCase() + element.type.slice(1);
    };

    const visibleLayers = [...elements]
        .filter(el => Boolean(el) && el.type)
        .map((element, index) => ({ element, index }))
        .reverse();

    const moveSelectedElement = (toIndex: number) => {
        if (selectedElementIndex < 0 || toIndex < 0 || toIndex >= elements.length || toIndex === selectedElementIndex) {
            return;
        }

        setElements((prev) => {
            const nextElements = [...prev];
            const [movedElement] = nextElements.splice(selectedElementIndex, 1);
            nextElements.splice(toIndex, 0, movedElement);
            return nextElements;
        });
    };

    const bringForward = () => moveSelectedElement(selectedElementIndex + 1);
    const sendBackward = () => moveSelectedElement(selectedElementIndex - 1);
    const bringToFront = () => moveSelectedElement(elements.length - 1);
    const sendToBack = () => moveSelectedElement(0);

    const undoChange = useCallback(() => {
        const previousSnapshot = undoStackRef.current.pop();
        if (!previousSnapshot) return;

        redoStackRef.current.push(createEditorSnapshot());
        applyEditorSnapshot(previousSnapshot);
    }, [applyEditorSnapshot, createEditorSnapshot]);

    const redoChange = useCallback(() => {
        const nextSnapshot = redoStackRef.current.pop();
        if (!nextSnapshot) return;

        undoStackRef.current.push(createEditorSnapshot());
        applyEditorSnapshot(nextSnapshot);
    }, [applyEditorSnapshot, createEditorSnapshot]);

    const selectedElement = elements.find(el => el.id === selectedId);
    const selectedElementType = selectedElement?.type || 'element';

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target instanceof HTMLElement && e.target.isContentEditable)) {
                return;
            }

            const isMetaOrCtrl = e.ctrlKey || e.metaKey;
            const key = e.key.toLowerCase();

            if (!isMetaOrCtrl) return;

            if (key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undoChange();
                return;
            }

            if (key === 'y' || (key === 'z' && e.shiftKey)) {
                e.preventDefault();
                redoChange();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [elements, title, canvasWidth, canvasHeight, canvasBgColor, undoChange, redoChange]);

    if (isLoading) return <div className="editor-loading">Loading Workspace...</div>;
    if (isError) return (
        <div className="editor-error">
            <h2>Oops! Project not found.</h2>
            <button className="button-agree" onClick={() => navigate('/home')}>Go to Dashboard</button>
        </div>
    );

    return (
        <div className="editor-layout">

            <header className="editor-topbar">
                <div className="topbar-left">
                    <button className="btn-back" onClick={handleExitClick} title="Back to Home">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                    </button>
                    <input
                        type="text"
                        className="project-title-input"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={handleSave}
                    />
                </div>
                <div className="topbar-center"></div>
                <div className="topbar-right">
                    <span className="save-status">
                        {restoreVersionMutation.isPending
                            ? 'Restoring version...'
                            : saveMutation.isPending
                                ? 'Saving...'
                                : 'All changes saved'}
                    </span>
                    <button
                        className="button-disagree"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleSave}
                    >
                        Save
                    </button>
                    <div data-export-menu style={{ position: 'relative' }}>
                        <button
                            className="button-agree"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => setShowExportMenu((value) => !value)}
                            disabled={isExporting}
                        >
                            {isExporting ? 'Exporting...' : 'Export'}
                        </button>

                        {showExportMenu && (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 8px)',
                                    right: 0,
                                    background: '#fff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '12px',
                                    boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)',
                                    minWidth: '180px',
                                    zIndex: 50,
                                    overflow: 'hidden',
                                }}
                            >
                                {(['png', 'jpg', 'svg', 'pdf'] as ExportFormat[]).map((format) => (
                                    <button
                                        key={format}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => handleExport(format)}
                                        style={{
                                            display: 'block',
                                            width: '100%',
                                            padding: '10px 14px',
                                            border: 'none',
                                            background: 'transparent',
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            fontSize: '13px',
                                            color: '#0f172a',
                                        }}
                                    >
                                        Export as {format.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <img
                        src={user?.avatar_url || '/default-avatar.png'}
                        alt="User"
                        className="editor-avatar"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/default-avatar.png'; }}
                    />
                </div>
            </header>

            <div className="editor-body">
                <aside
                    className={`editor-sidebar-left ${isSidebarOpen ? 'open' : ''}`}
                    style={{ overflowY: 'auto', overflowX: 'hidden' }}
                >
                    <button className="tool-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)} title="Toggle Tools">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="3" y1="12" x2="21" y2="12"></line>
                            <line x1="3" y1="6" x2="21" y2="6"></line>
                            <line x1="3" y1="18" x2="21" y2="18"></line>
                        </svg>
                    </button>

                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center' }}>
                        <button
                            className={`tool-btn ${mode === 'draw' ? 'active' : ''}`}
                            title="Draw"
                            onClick={() => {
                                setIsSidebarOpen(true);
                                if (mode === 'draw') {
                                    setMode('select');
                                    setShowDrawMenu(false);
                                } else {
                                    setMode('draw');
                                    setShowDrawMenu(true);
                                    setSelectedId(null);
                                }
                            }}
                        >
                            <img src="/draw-icon.png" alt="Draw" /><span className="tool-text">Draw</span>
                        </button>

                        {showDrawMenu && mode === 'draw' && isSidebarOpen && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 36px)', gap: '6px', padding: '10px 0', width: '100%', justifyContent: 'center', flexWrap: 'nowrap' }}>
                                <button
                                    onClick={() => setDrawTool('pen')}
                                    style={{ width: '36px', height: '36px', background: drawTool === 'pen' ? '#e2e8f0' : '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '6px' }}
                                    title="Pen"
                                >
                                    <img src="/pen-icon.png" alt="Pen" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.8 }} />
                                </button>

                                <button
                                    onClick={() => setDrawTool('line')}
                                    style={{ width: '36px', height: '36px', background: drawTool === 'line' ? '#e2e8f0' : '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '6px' }}
                                    title="Straight Line"
                                >
                                    <img src="/line-icon.png" alt="Eraser" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.8 }} />
                                </button>

                                <button
                                    onClick={() => setDrawTool('arrow')}
                                    style={{ width: '36px', height: '36px', background: drawTool === 'arrow' ? '#e2e8f0' : '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '6px' }}
                                    title="Arrow"
                                >
                                    <img src="/arrow-icon.png" alt="Eraser" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.8 }} />
                                </button>

                                <button
                                    onClick={() => {
                                        setMode('draw');
                                        setDrawTool('dashed');
                                    }}
                                    style={{ width: '36px', height: '36px', background: drawTool === 'dashed' ? '#e2e8f0' : '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '6px' }}
                                    title="Dashed Line"
                                >
                                    <img src="/dashed-icon.png" alt="Eraser" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.8 }} />
                                </button>

                                <button
                                    onClick={() => setDrawTool('eraser')}
                                    style={{ width: '36px', height: '36px', background: drawTool === 'eraser' ? '#e2e8f0' : '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '6px' }}
                                    title="Eraser"
                                >
                                    <img src="/eraser-icon.png" alt="Eraser" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.8 }} />
                                </button>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center' }}>
                        <button
                            className={`tool-btn ${showShapesMenu ? 'active' : ''}`}
                            title="Shapes"
                            onClick={() => {
                                setIsSidebarOpen(true);
                                setShowShapesMenu(!showShapesMenu);
                            }}
                        >
                            <img src="/shapes-icon.png" alt="Shapes" />
                            <span className="tool-text">Shapes</span>
                        </button>

                        {showShapesMenu && isSidebarOpen && (
                            <div style={{
                                display: 'flex', gap: '6px', padding: '10px 0', width: '100%', justifyContent: 'center', flexWrap: 'nowrap'
                            }}>
                                <button
                                    onClick={() => handleAddShape('rect')}
                                    style={{ width: '36px', height: '36px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '6px' }}
                                    title="Rectangle"
                                >
                                    <img src="/square-icon.png" alt="Rectangle" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.8 }} />
                                </button>
                                <button
                                    onClick={() => handleAddShape('ellipse')}
                                    style={{ width: '36px', height: '36px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '6px' }}
                                    title="Circle"
                                >
                                    <img src="/circle-icon.png" alt="Circle" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.8 }} />
                                </button>
                                <button
                                    onClick={() => handleAddShape('triangle')}
                                    style={{ width: '36px', height: '36px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '6px' }}
                                    title="Triangle"
                                >
                                    <img src="/triangle-icon.png" alt="Triangle" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.8 }} />
                                </button>
                                <button
                                    onClick={() => handleAddShape('star')}
                                    style={{ width: '36px', height: '36px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '6px' }}
                                    title="Star"
                                >
                                    <img src="/star-icon.png" alt="Star" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.8 }} />
                                </button>
                            </div>
                        )}
                    </div>

                    <button className="tool-btn" title="Text" onClick={handleAddText}><img src="/text-icon.png" alt="Text" /><span className="tool-text">Text</span></button>
                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center' }}>
                        <button
                            className={`tool-btn ${showImageMenu ? 'active' : ''}`}
                            title="Image"
                            onClick={() => {
                                setIsSidebarOpen(true);
                                setShowImageMenu(!showImageMenu);
                            }}
                        >
                            <img src="/image-icon.png" alt="Image" />
                            <span className="tool-text">Image</span>
                        </button>

                        {showImageMenu && isSidebarOpen && (
                            <div className="history-dropdown-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                                <button
                                    className="button-agree"
                                    onClick={handleImageClick}
                                    style={{ width: '100%', padding: '10px', fontSize: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line>
                                    </svg>
                                    Upload new
                                </button>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Project uploads</span>

                                    {isAssetsLoading ? (
                                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Loading...</span>
                                    ) : projectAssets.length > 0 ? (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                            {projectAssets.map((asset: any) => (
                                                <div
                                                    key={asset.id}
                                                    onClick={() => handleAddExistingImage(asset.url)}
                                                    style={{
                                                        width: '100%', height: '50px',
                                                        backgroundImage: `url(${asset.url})`, backgroundSize: 'cover', backgroundPosition: 'center',
                                                        borderRadius: '4px', cursor: 'pointer', border: '1px solid #e2e8f0'
                                                    }}
                                                    title="Add to canvas"
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>No images yet</span>
                                    )}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>System library</span>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                                        {SYSTEM_IMAGES.map((src, index) => (
                                            <div
                                                key={`sys-${index}`}
                                                onClick={() => handleAddExistingImage(src)}
                                                style={{
                                                    width: '100%', height: '50px',
                                                    backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center',
                                                    borderRadius: '4px', cursor: 'pointer', border: '1px solid #e2e8f0'
                                                }}
                                                title="Add to canvas"
                                            />
                                        ))}
                                    </div>
                                </div>

                            </div>
                        )}
                    </div>
                    <div className="tool-divider"></div>

                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center' }}>
                        <button
                            className={`tool-btn ${showHistoryMenu ? 'active' : ''}`}
                            title="History"
                            onClick={() => {
                                setIsSidebarOpen(true);
                                setShowHistoryMenu(!showHistoryMenu);
                            }}
                        >
                            <img src="/history-icon.png" alt="History" />
                            <span className="tool-text">History</span>
                        </button>

                        {showHistoryMenu && isSidebarOpen && (
                            <div className="history-dropdown-container">
                                <span className="history-title">Saved versions</span>

                                {isHistoryLoading && <span className="history-empty">Loading versions...</span>}
                                {isHistoryError && <span className="history-error">Failed to load history</span>}

                                {!isHistoryLoading && !isHistoryError && visibleHistoryVersions.length === 0 && (
                                    <span className="history-empty">No saved versions yet</span>
                                )}

                                {!isHistoryLoading && !isHistoryError && visibleHistoryVersions.map((version) => (
                                    <div key={version.id} className="history-item">
                                        <div className="history-item-top">
                                            {version.thumbnail_url ? (
                                                <div
                                                    className="history-thumb"
                                                    style={{ backgroundImage: `url(${version.thumbnail_url})` }}
                                                />
                                            ) : (
                                                <div className="history-thumb history-thumb-empty">No preview</div>
                                            )}

                                            <div className="history-meta">
                                                <strong>Version {version.version}</strong>
                                                <span>{formatHistoryDate(version.created_at)}</span>
                                            </div>
                                        </div>

                                        <button
                                            className="button-secondary history-restore-btn"
                                            onClick={() => restoreVersionMutation.mutate(version.id)}
                                            disabled={restoreVersionMutation.isPending}
                                        >
                                            Restore
                                        </button>
                                    </div>
                                ))}

                                {historyMessage && (
                                    <span className={historyMessage.type === 'success' ? 'history-success' : 'history-error'}>
                                        {historyMessage.text}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center', marginTop: '10px' }}>
                        <button
                            className={`tool-btn ${showTemplateMenu ? 'active' : ''}`}
                            title="Template"
                            onClick={() => {
                                setIsSidebarOpen(true);
                                setShowTemplateMenu(!showTemplateMenu);
                            }}
                        >
                            <img src="/template-icon.png" alt="Template" />
                            <span className="tool-text">Template</span>
                        </button>

                        {showTemplateMenu && isSidebarOpen && (
                            <div className="history-dropdown-container">
                                <span style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', lineHeight: '1.2' }}>
                                    Save the current project with all elements as a template
                                </span>
                                <button
                                    onClick={() => saveAsTemplateMutation.mutate()}
                                    disabled={saveAsTemplateMutation.isPending || restoreVersionMutation.isPending}
                                   className="button-secondary"
                                    style={{ width: '100%', padding: '8px 12px', fontSize: '12px', marginTop: '8px' }}
                                >
                                    {saveAsTemplateMutation.isPending ? 'Saving...' : 'Save the template'}
                                </button>
                                {templateMessage && (
                                    <span style={{
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        marginTop: '4px',
                                        color: templateMessage.type === 'success' ? '#10b981' : '#ef4444',
                                        textAlign: 'center'
                                    }}>
                                        {templateMessage.text}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </aside>

                <main
                    className="editor-canvas-container"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setSelectedId(null);
                        }
                    }}
                >
                    <div
                        className="canvas-wrapper"
                        style={{
                            width: `${canvasWidth}px`, height: `${canvasHeight}px`, backgroundColor: canvasBgColor,
                            backgroundImage: showGrid ? 'linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)' : 'none',
                            backgroundSize: '20px 20px', transition: 'width 0.3s, height 0.3s, background-color 0.3s',
                            cursor: mode === 'draw' ? 'crosshair' : 'default'
                        }}
                    >
                        <WorkspaceCanvas
                            width={canvasWidth}
                            height={canvasHeight}
                            elements={elements}
                            setElements={setElements}
                            selectedId={selectedId}
                            setSelectedId={setSelectedId}

                            mode={mode}
                            drawTool={drawTool}
                            drawColor={drawColor}
                            drawSize={drawSize}
                            onStageReady={(stage) => {
                                stageRef.current = stage;
                            }}
                            showGrid={showGrid}
                        />
                    </div>
                </main>

                <aside className="editor-sidebar-right">
                    <div className="properties-panel">

                        {mode === 'draw' ? (
                            <div  style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <h3>Draw Properties</h3>
                                {drawTool !== 'eraser' && (
                                    <div className="prop-group">
                                        <label>Brush Color</label>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <input type="color" value={drawColor} onChange={(e) => setDrawColor(e.target.value)} />
                                            <input type="text" value={drawColor} onChange={(e) => setDrawColor(e.target.value)} style={{ flex: 1, textTransform: 'uppercase' }} />
                                        </div>
                                    </div>
                                )}
                                <div className="prop-group">
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <label>{drawTool === 'eraser' ? 'Eraser Size' : 'Brush Size'}</label>
                                        <span style={{ fontSize: '12px', color: '#6C8CAB', fontWeight: 'bold' }}>{drawSize}px</span>
                                    </div>
                                    <input type="range" value={drawSize} onChange={(e) => setDrawSize(Number(e.target.value))} min="1" max="100" style={{ appearance: 'none', width: '100%', background: 'transparent', cursor: 'pointer', backgroundColor: '#e2e8f0', height: '6px', borderRadius: '10px' }} />
                                </div>
                            </div>
                        ) : !selectedElement ? (
                            < div className="prop" style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <h3>Canvas Properties</h3>
                                <div className="prop-group"><label>Canvas Width</label><input type="number" value={canvasWidth} onChange={(e) => setCanvasWidth(Number(e.target.value) || 1)} min="1" /></div>
                                <div className="prop-group"><label>Canvas Height</label><input type="number" value={canvasHeight} onChange={(e) => setCanvasHeight(Number(e.target.value) || 1)} min="1" /></div>
                                <div className="prop-group"><label>Background</label><div style={{ display: 'flex', gap: '10px' }}><input type="color" value={canvasBgColor} onChange={(e) => setCanvasBgColor(e.target.value)} /><input type="text" value={canvasBgColor} onChange={(e) => setCanvasBgColor(e.target.value)} style={{ flex: 1, textTransform: 'uppercase' }} /></div></div>
                                <div className="prop-group">
                                    <label>History</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <button
                                            className="button-secondary"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={undoChange}
                                            title="Undo (Ctrl+Z)"
                                            style={{ padding: '8px 10px', marginBottom: 0 }}
                                        >
                                            Undo
                                        </button>
                                        <button
                                            className="button-secondary"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={redoChange}
                                            title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
                                            style={{ padding: '8px 10px', marginBottom: 0 }}
                                        >
                                            Redo
                                        </button>
                                    </div>
                                </div>
                                <div className="prop-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '20px' }}><input type="checkbox" id="gridToggle" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} style={{ width: 'auto', cursor: 'pointer', transform: 'scale(1.2)' }} /><label htmlFor="gridToggle" style={{ margin: 0, cursor: 'pointer' }}>Show Grid</label></div>
                            </div>
                        ) : (
                            <div  style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <h3>{selectedElementType.toUpperCase()} PROPERTIES</h3>

                                {selectedElementType === 'line' && (
                                    <>
                                        <div className="prop-group" >
                                            <label>Line Color</label>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <input type="color" value={selectedElement.stroke} onChange={(e) => updateSelectedElement('stroke', e.target.value)} />
                                                <input type="text" value={selectedElement.stroke} onChange={(e) => updateSelectedElement('stroke', e.target.value)} style={{ flex: 1, textTransform: 'uppercase' }} />
                                            </div>
                                        </div>
                                        <div className="prop-group" style={{ marginTop: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <input
                                                    type="checkbox"
                                                    id="dashedToggle"
                                                    checked={selectedElement.dash && selectedElement.dash.length > 0}
                                                    onChange={(e) => {
                                                        const dashValue = e.target.checked ? [10, 10] : [];
                                                        updateSelectedElement('dash', dashValue);
                                                    }}
                                                    style={{ width: 'auto', cursor: 'pointer' }}
                                                />
                                                <label htmlFor="dashedToggle" style={{ margin: 0, cursor: 'pointer' }}>
                                                    Dashed Line
                                                </label>
                                            </div>

                                            {selectedElement.dash && selectedElement.dash.length > 0 && (
                                                <div className="prop-group" style={{ marginTop: '10px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                                        <label>Dash Pattern</label>
                                                        <span style={{ fontSize: '12px', color: '#6C8CAB', fontWeight: 'bold' }}>{selectedElement.dash[0]}px</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="1"
                                                        max="50"
                                                        className="dash-slider"
                                                        value={selectedElement.dash[0]}
                                                        onChange={(e) => {
                                                            const val = Number(e.target.value);
                                                            updateSelectedElement('dash', [val, val]);
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}

                                {selectedElementType === 'text' && (
                                    <>
                                        <div className="prop-group"><label>Text Content</label><textarea value={selectedElement.text} onChange={(e) => updateSelectedElement('text', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0', minHeight: '50px' }} /></div>
                                        <div className="prop-group">
                                            <label>Font Family</label>
                                            <select
                                                value={selectedElement.fontFamily || 'Arial'}
                                                onChange={(e) => updateSelectedElement('fontFamily', e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    padding: '8px',
                                                    borderRadius: '6px',
                                                    border: '1px solid #e2e8f0',
                                                    marginBottom: '10px',
                                                    fontFamily: selectedElement.fontFamily || 'Arial'
                                                }}
                                            >
                                                <option value="Arial">Arial</option>
                                                <option value="Courier New">Courier New</option>
                                                <option value="Georgia">Georgia</option>
                                                <option value="Times New Roman">Times New Roman</option>
                                                <option value="Verdana">Verdana</option>
                                                <option value="Tahoma">Tahoma</option>
                                                <option value="Trebuchet MS">Trebuchet MS</option>
                                            </select>

                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    className="button-secondary"
                                                    style={{ flex: 1, fontSize: '11px', padding: '6px' }}
                                                    onClick={() => console.log('Upload font trigger')}
                                                >
                                                    Upload Font
                                                </button>
                                                <button
                                                    className="button-secondary"
                                                    style={{ flex: 1, fontSize: '11px', padding: '6px', color: '#ef4444' }}
                                                    onClick={() => console.log('Delete font trigger')}
                                                >
                                                    Delete Font
                                                </button>
                                            </div>
                                        </div>
                                        <div className="prop-group"><label>Font Size</label><input type="number" value={Math.round(selectedElement.fontSize)} onChange={(e) => updateSelectedElement('fontSize', Number(e.target.value))} /></div>
                                        <div className="prop-group"><label>Text Color</label><div style={{ display: 'flex', gap: '10px' }}><input type="color" value={selectedElement.fill} onChange={(e) => updateSelectedElement('fill', e.target.value)} /><input type="text" value={selectedElement.fill} onChange={(e) => updateSelectedElement('fill', e.target.value)} style={{ flex: 1, textTransform: 'uppercase' }} /></div></div>

                                        <div className="prop-group">
                                            <label>Text Style</label>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button className={`button-secondary ${selectedElement.fontStyle === 'bold' || selectedElement.fontStyle === 'italic bold' ? 'active' : ''}`} style={{ padding: '6px 12px', flex: 1, fontWeight: 'bold', background: selectedElement.fontStyle?.includes('bold') ? '#e2e8f0' : '#f8fafc' }} onClick={() => { const current = selectedElement.fontStyle || 'normal'; const isBold = current.includes('bold'); const isItalic = current.includes('italic'); updateSelectedElement('fontStyle', (!isBold && isItalic) ? 'italic bold' : (!isBold && !isItalic) ? 'bold' : (isBold && isItalic) ? 'italic' : 'normal'); }}>B</button>
                                                <button className={`button-secondary ${selectedElement.fontStyle === 'italic' || selectedElement.fontStyle === 'italic bold' ? 'active' : ''}`} style={{ padding: '6px 12px', flex: 1, fontStyle: 'italic', background: selectedElement.fontStyle?.includes('italic') ? '#e2e8f0' : '#f8fafc' }} onClick={() => { const current = selectedElement.fontStyle || 'normal'; const isBold = current.includes('bold'); const isItalic = current.includes('italic'); updateSelectedElement('fontStyle', (!isItalic && isBold) ? 'italic bold' : (!isItalic && !isBold) ? 'italic' : (isItalic && isBold) ? 'bold' : 'normal'); }}>I</button>
                                                <button className={`button-secondary`} style={{ padding: '6px 12px', flex: 1, textDecoration: 'underline', background: selectedElement.textDecoration === 'underline' ? '#e2e8f0' : '#f8fafc' }} onClick={() => updateSelectedElement('textDecoration', selectedElement.textDecoration === 'underline' ? '' : 'underline')}>U</button>
                                            </div>
                                        </div>

                                        <div className="prop-group">
                                            <label>Alignment</label>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                {['left', 'center', 'right'].map((align) => (
                                                    <button key={align} className="button-secondary" style={{ padding: '6px', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: selectedElement.align === align ? '#e2e8f0' : '#f8fafc', border: selectedElement.align === align ? '1px solid #cbd5e1' : '1px solid transparent' }} onClick={() => updateSelectedElement('align', align)} title={`Align ${align}`}>
                                                        <img src={`/align-${align}.png`} alt={`Align ${align}`} style={{ width: '20px', height: '20px', objectFit: 'contain', opacity: selectedElement.align === align ? 1 : 0.6 }} />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}

                                {selectedElementType === 'shape' && (
                                    <>
                                        <div className="prop-group"><label>Shape Color</label><div style={{ display: 'flex', gap: '10px' }}><input type="color" value={selectedElement.fill} onChange={(e) => updateSelectedElement('fill', e.target.value)} /><input type="text" value={selectedElement.fill} onChange={(e) => updateSelectedElement('fill', e.target.value)} style={{ flex: 1, textTransform: 'uppercase' }} /></div></div>
                                        {selectedElement.shapeType === 'rect' && (
                                            <div className="prop-group"><label>Corner Radius</label><input type="number" value={selectedElement.cornerRadius || 0} onChange={(e) => updateSelectedElement('cornerRadius', Number(e.target.value))} min="0" max={Math.min(selectedElement.width, selectedElement.height) / 2} /></div>
                                        )}
                                        {selectedElement.shapeType === 'star' && (
                                            <>
                                                <div className="prop-group"><label>Points</label><input type="number" value={selectedElement.numPoints || 5} onChange={(e) => updateSelectedElement('numPoints', Math.max(3, Number(e.target.value)))} min="3" /></div>
                                                <div className="prop-group">
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><label>Inner Radius Ratio</label><span style={{ fontSize: '12px', color: '#6C8CAB', fontWeight: 'bold' }}>{selectedElement.innerRadius || 35}%</span></div>
                                                    <input type="range" value={selectedElement.innerRadius || 35} onChange={(e) => updateSelectedElement('innerRadius', Number(e.target.value))} min="1" max="70" style={{ appearance: 'none', width: '100%', background: 'transparent', cursor: 'pointer', backgroundColor: '#e2e8f0', height: '6px', borderRadius: '10px' }} />
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}

                                {selectedElement.type !== 'line' && (
                                    <div className="prop-group" style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                                        <div style={{ flex: 1 }}><label>X</label><input type="number" value={Math.round(selectedElement.x)} onChange={(e) => updateSelectedElement('x', Number(e.target.value))} /></div>
                                        <div style={{ flex: 1 }}><label>Y</label><input type="number" value={Math.round(selectedElement.y)} onChange={(e) => updateSelectedElement('y', Number(e.target.value))} /></div>
                                    </div>
                                )}

                                <div className="prop-group">
                                    <label>Layer</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <button className="button-secondary" onClick={sendToBack} disabled={selectedElementIndex <= 0} style={{ padding: '8px 10px', marginBottom: 0 }}>
                                            Send to back
                                        </button>
                                        <button className="button-secondary" onClick={bringToFront} disabled={selectedElementIndex < 0 || selectedElementIndex >= elements.length - 1} style={{ padding: '8px 10px', marginBottom: 0 }}>
                                            Bring to front
                                        </button>
                                        <button className="button-secondary" onClick={sendBackward} disabled={selectedElementIndex <= 0} style={{ padding: '8px 10px', marginBottom: 0 }}>
                                            Move backward
                                        </button>
                                        <button className="button-secondary" onClick={bringForward} disabled={selectedElementIndex < 0 || selectedElementIndex >= elements.length - 1} style={{ padding: '8px 10px', marginBottom: 0 }}>
                                            Move forward
                                        </button>
                                    </div>
                                </div>

                                {selectedElement.type === 'image' && (
                                    <div className="prop-group">
                                        <label>Image Filters</label>
                                        <button
                                            className={`button-secondary ${showFiltersMenu ? 'active' : ''}`}
                                            onClick={() => setShowFiltersMenu(!showFiltersMenu)}
                                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                        >
                                            <img src="/filter-icon.png" alt="" style={{ width: '16px', height: '16px' }} />
                                            {selectedElement.filter || 'No Filter'}
                                        </button>

                                        {showFiltersMenu && (
                                            <div className="filters-dropdown-container" style={{
                                                marginTop: '10px',
                                                display: 'grid',
                                                gridTemplateColumns: '1fr 1fr',
                                                gap: '8px',
                                                background: '#f8fafc',
                                                padding: '10px',
                                                borderRadius: '8px',
                                                border: '1px solid #e2e8f0'
                                            }}>
                                                {FILTERS_LIST.map((f) => (
                                                    <div
                                                        key={f.name}
                                                        onClick={() => {
                                                            updateSelectedElement('filter', f.filter);
                                                        }}
                                                        style={{
                                                            cursor: 'pointer',
                                                            textAlign: 'center',
                                                            padding: '4px',
                                                            borderRadius: '4px',
                                                            border: selectedElement.filter === f.filter ? '2px solid #3b82f6' : '1px solid transparent'
                                                        }}
                                                    >
                                                        <div
                                                            className={`filter-preview-box ${f.previewClass}`}
                                                            style={{
                                                                width: '100%',
                                                                height: '50px',
                                                                backgroundImage: `url(${selectedElement.src})`,
                                                                backgroundSize: 'cover',
                                                                backgroundPosition: 'center',
                                                                borderRadius: '4px',
                                                                marginBottom: '4px'
                                                            }}
                                                        />
                                                        <span style={{ fontSize: '10px', fontWeight: 'bold' }}>{f.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {['image', 'shape'].includes(selectedElement.type) && (
                                    <div className="prop-group" style={{ display: 'flex', gap: '10px' }}>
                                        <div style={{ flex: 1 }}>
                                            <label>Width</label>
                                            <input type="number" value={Math.round(selectedElement.width)} onChange={(e) => {
                                                const val = Number(e.target.value);
                                                updateSelectedElement('width', val);
                                                if (selectedElement.baseWidth) {
                                                    const signX = (selectedElement.scaleX || 1) < 0 ? -1 : 1;
                                                    updateSelectedElement('scaleX', (val / selectedElement.baseWidth) * signX);
                                                }
                                            }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label>Height</label>
                                            <input type="number" value={Math.round(selectedElement.height)} onChange={(e) => {
                                                const val = Number(e.target.value);
                                                updateSelectedElement('height', val);
                                                if (selectedElement.baseHeight) {
                                                    const signY = (selectedElement.scaleY || 1) < 0 ? -1 : 1;
                                                    updateSelectedElement('scaleY', (val / selectedElement.baseHeight) * signY);
                                                }
                                            }} />
                                        </div>
                                    </div>
                                )}

                                {selectedElement.type && (
                                    <div className="prop-group">
                                        <label>Flip</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                            <button
                                                className="button-secondary"
                                                onClick={() => flipSelectedElement('x')}
                                                style={{ padding: '8px 10px', marginBottom: 0 }}
                                            >
                                                Flip X
                                            </button>
                                            <button
                                                className="button-secondary"
                                                onClick={() => flipSelectedElement('y')}
                                                style={{ padding: '8px 10px', marginBottom: 0 }}
                                            >
                                                Flip Y
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <button className="button-secondary" style={{ width: '100%', marginTop: '20px', background: '#fee2e2', color: '#ef4444', border: '1px solid #fdcece' }} onClick={() => { setElements(elements.filter(el => el.id !== selectedId)); setSelectedId(null); }}>Delete Element</button>
                            </div>
                        )}
                        <div className="layer-panel">
                            <h3>Layers</h3>
                            <div className="layer-list">
                                {visibleLayers.map(({ element }, position) => {
                                    const isActive = element.id === selectedId;

                                    return (
                                        <button
                                            key={element.id}
                                            type="button"
                                            className={`layer-item ${isActive ? 'active' : ''}`}
                                            onClick={() => setSelectedId(element.id)}
                                            title={`Select ${getLayerLabel(element)}`}
                                        >
                                            <span className="layer-order">{visibleLayers.length - position}</span>
                                            <span className="layer-name">{getLayerLabel(element)}</span>
                                            <span className="layer-type">{element.type}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </aside>

            </div>

            <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />

            {showExitModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
                    display: 'flex', justifyContent: 'center', alignItems: 'center'
                }}>
                    <div style={{
                        background: 'white', padding: '24px', borderRadius: '12px',
                        width: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                        display: 'flex', flexDirection: 'column', gap: '16px'
                    }}>
                        <h3 style={{ margin: 0, color: 'var(--primary-color)' }}>Unsaved Changes</h3>
                        <p style={{ margin: 0, color: '#475569', fontSize: '14px', lineHeight: '1.5' }}>
                            You have unsaved changes on your canvas. Do you want to save them before leaving?
                        </p>
                        <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
                            <button
                                className="button-secondary"
                                onClick={() => setShowExitModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="button-secondary"
                                style={{ background: '#fee2e2', color: '#ef4444', border: '1px solid #fdcece' }}
                                onClick={() => navigate('/home')}
                            >
                                Leave
                            </button>
                            <button
                                className="button-secondary"
                                onClick={async () => {
                                    try {
                                        await saveMutation.mutateAsync({
                                            title, width: canvasWidth, height: canvasHeight, bgColor: canvasBgColor, elements, thumbnailDataUrl: generateThumbnailDataUrl()
                                        });
                                        navigate('/home');
                                    } catch (e) {
                                        console.error(e);
                                    }
                                }}
                            >
                                {saveMutation.isPending ? 'Saving...' : 'Save & Leave'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}