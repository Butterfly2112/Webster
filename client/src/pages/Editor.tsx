import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '../api/http';
import { useAuthStore } from '../store/auth';
import WorkspaceCanvas from '../components/WorkspaceCanvas';

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

    // Dynamic canvas element schemas vary by tool and are validated at runtime.
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

    const [showShapesMenu, setShowShapesMenu] = useState(false);
    const [showDrawMenu, setShowDrawMenu] = useState(false);
    const [showHistoryMenu, setShowHistoryMenu] = useState(false);
    const [showTemplateMenu, setShowTemplateMenu] = useState(false);
    const [templateMessage, setTemplateMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null);
    const [historyMessage, setHistoryMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null);

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const loadedProjectIdRef = useRef<number | null>(null);
    const saveLockRef = useRef(false);

    const [mode, setMode] = useState<'select' | 'draw'>('select');
    const [drawTool, setDrawTool] = useState<'pen' | 'marker' | 'eraser' | 'line' | 'arrow' | 'dashed'>('pen');
    const [drawColor, setDrawColor] = useState('#000000');
    const [drawSize, setDrawSize] = useState(5);

    const applyProjectState = (projectData: {
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

        setTitle(projectData.title || 'Untitled Design');
        if (projectData.width) setCanvasWidth(projectData.width);
        if (projectData.height) setCanvasHeight(projectData.height);

        if (parsedCanvas?.attrs?.backgroundColor) {
            setCanvasBgColor(parsedCanvas.attrs.backgroundColor);
        }

        if (parsedCanvas?.children) {
            setElements(parsedCanvas.children);
        }

        setSelectedId(null);
        setMode('select');
        loadedProjectIdRef.current = projectData.id;
    };

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

    useEffect(() => {
        if (project && loadedProjectIdRef.current !== project.id) {
            applyProjectState(project);
        }
    }, [project]);

    useEffect(() => {
        if (!historyMessage) return;

        const timeout = setTimeout(() => setHistoryMessage(null), 3000);
        return () => clearTimeout(timeout);
    }, [historyMessage]);

    const uploadAssetMutation = useMutation({
        mutationFn: async (formData: FormData) => {
            const response = await customFetch(`/api/project/${id}/assets`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error('Failed to upload image');
            return response.json() as Promise<{ url: string; public_id: string; width: number; height: number }>;
        },
        onSuccess: (result) => {
            let insertWidth = result.width;
            let insertHeight = result.height;

            if (insertWidth > 400) {
                const ratio = 400 / insertWidth;
                insertWidth = 400;
                insertHeight = insertHeight * ratio;
            }

            const newImage = {
                id: Date.now().toString(),
                type: 'image',
                src: result.url,
                cloudinaryId: result.public_id,
                x: 50,
                y: 50,
                width: insertWidth,
                height: insertHeight,
            };

            setElements((prev) => [...prev, newImage]);
            setMode('select');
            setSelectedId(newImage.id);

            if (fileInputRef.current) fileInputRef.current.value = '';
        },
        onError: (err) => {
            console.error(err);
            alert("Failed to upload image.");
        }
    });

    const handleImageClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        uploadAssetMutation.mutate(formData);
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
                backgroundColor: updateData.bgColor
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
                backgroundColor: canvasBgColor
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

    const selectedElement = elements.find(el => el.id === selectedId);
    const selectedElementType = selectedElement?.type || 'element';

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
                    <button className="btn-back" onClick={() => navigate('/home')} title="Back to Home">
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
                    <button className="button-agree">Export</button>
                    <img
                        src={user?.avatar_url || '/default-avatar.png'}
                        alt="User"
                        className="editor-avatar"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/default-avatar.png'; }}
                    />
                </div>
            </header>

            <div className="editor-body">
                <aside className={`editor-sidebar-left ${isSidebarOpen ? 'open' : ''}`}>
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
                    <button className="tool-btn" title="Image" onClick={handleImageClick}><img src="/image-icon.png" alt="Image" /><span className="tool-text">Image</span></button>
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
                            <div style={{
                                display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 10px', width: '100%',
                                alignItems: 'center'
                            }}>
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

                <main className="editor-canvas-container">
                    <div
                        className="canvas-wrapper"
                        style={{
                            width: `${canvasWidth}px`, height: `${canvasHeight}px`, backgroundColor: canvasBgColor,
                            backgroundImage: showGrid ? 'linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)' : 'none',
                            backgroundSize: '20px 20px', transition: 'width 0.3s, height 0.3s, background-color 0.3s',
                            cursor: mode === 'draw' ? 'crosshair' : 'default' // Змінюємо курсор при малюванні
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
                        />
                    </div>
                </main>

                <aside className="editor-sidebar-right">
                    <div className="properties-panel">

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

                        {mode === 'draw' ? (
                            <>
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
                            </>
                        ) : !selectedElement ? (
                            <>
                                <h3>Canvas Properties</h3>
                                <div className="prop-group"><label>Canvas Width</label><input type="number" value={canvasWidth} onChange={(e) => setCanvasWidth(Number(e.target.value) || 1)} min="1" /></div>
                                <div className="prop-group"><label>Canvas Height</label><input type="number" value={canvasHeight} onChange={(e) => setCanvasHeight(Number(e.target.value) || 1)} min="1" /></div>
                                <div className="prop-group"><label>Background</label><div style={{ display: 'flex', gap: '10px' }}><input type="color" value={canvasBgColor} onChange={(e) => setCanvasBgColor(e.target.value)} /><input type="text" value={canvasBgColor} onChange={(e) => setCanvasBgColor(e.target.value)} style={{ flex: 1, textTransform: 'uppercase' }} /></div></div>
                                <div className="prop-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '20px' }}><input type="checkbox" id="gridToggle" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} style={{ width: 'auto', cursor: 'pointer', transform: 'scale(1.2)' }} /><label htmlFor="gridToggle" style={{ margin: 0, cursor: 'pointer' }}>Show Grid</label></div>
                            </>
                        ) : (
                            <>
                                <h3>{selectedElementType.toUpperCase()} PROPERTIES</h3>

                                {selectedElementType === 'line' && (
                                    <>
                                        <div className="prop-group">
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
                                                if (selectedElement.baseWidth) updateSelectedElement('scaleX', val / selectedElement.baseWidth);
                                            }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label>Height</label>
                                            <input type="number" value={Math.round(selectedElement.height)} onChange={(e) => {
                                                const val = Number(e.target.value);
                                                updateSelectedElement('height', val);
                                                if (selectedElement.baseHeight) updateSelectedElement('scaleY', val / selectedElement.baseHeight);
                                            }} />
                                        </div>
                                    </div>
                                )}

                                <button className="button-secondary" style={{ width: '100%', marginTop: '20px', background: '#fee2e2', color: '#ef4444', border: '1px solid #fdcece' }} onClick={() => { setElements(elements.filter(el => el.id !== selectedId)); setSelectedId(null); }}>Delete Element</button>
                            </>
                        )}
                    </div>
                </aside>

            </div>

            <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />

        </div>
    );
}