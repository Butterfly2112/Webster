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

    const [title, setTitle] = useState('Loading...');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const [canvasWidth, setCanvasWidth] = useState(800);
    const [canvasHeight, setCanvasHeight] = useState(600);
    const [canvasBgColor, setCanvasBgColor] = useState('#ffffff');
    const [showGrid, setShowGrid] = useState(false);

    const [elements, setElements] = useState<any[]>([]);

    const [showShapesMenu, setShowShapesMenu] = useState(false);
    const [showDrawMenu, setShowDrawMenu] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const [mode, setMode] = useState<'select' | 'draw'>('select');
    const [drawTool, setDrawTool] = useState<'pen' | 'marker' | 'eraser'>('pen');
    const [drawColor, setDrawColor] = useState('#000000');
    const [drawSize, setDrawSize] = useState(5);

    const { data: project, isLoading, isError } = useQuery({
        queryKey: ['project', id],
        queryFn: async () => {
            const response = await customFetch(`/api/project/${id}`);
            if (!response.ok) throw new Error('Project not found');
            return response.json();
        },
        enabled: !!id && id !== 'new',
    });

    useEffect(() => {
        if (project) {
            setTitle(project.title || 'Untitled Design');
            if (project.width) setCanvasWidth(project.width);
            if (project.height) setCanvasHeight(project.height);

            if (project.canvasData?.attrs?.backgroundColor) {
                setCanvasBgColor(project.canvasData.attrs.backgroundColor);
            }

            if (project.canvasData?.children) {
                setElements(project.canvasData.children);
            }
        }
    }, [project]);

    const uploadAssetMutation = useMutation({
        mutationFn: async (formData: FormData) => {
            const response = await customFetch(`/api/upload/image`, {
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
        mutationFn: async (updateData: { title: string; width: number; height: number; bgColor: string; elements: any[] }) => {
            let currentCanvasData = typeof project.canvasData === 'string'
                ? JSON.parse(project.canvasData)
                : JSON.parse(JSON.stringify(project?.canvasData || { className: 'Stage', attrs: {}, children: [] }));

            currentCanvasData.attrs = {
                ...currentCanvasData.attrs,
                backgroundColor: updateData.bgColor
            };

            currentCanvasData.children = updateData.elements;

            const response = await customFetch(`/api/project/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: updateData.title,
                    width: updateData.width,
                    height: updateData.height,
                    canvasData: currentCanvasData
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
        }
    });

    const handleSave = () => {
        saveMutation.mutate({
            title, width: canvasWidth, height: canvasHeight, bgColor: canvasBgColor, elements
        });
    };

    const updateSelectedElement = (key: string, value: any) => {
        setElements(elements.map(el => el.id === selectedId ? { ...el, [key]: value } : el));
    };

    const selectedElement = elements.find(el => el.id === selectedId);

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
                        {saveMutation.isPending ? 'Saving...' : 'All changes saved'}
                    </span>
                    <button className="button-disagree" onClick={handleSave}>Save</button>
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
                            <div style={{ display: 'flex', gap: '6px', padding: '10px 0', width: '100%', justifyContent: 'center', flexWrap: 'nowrap' }}>
                                <button
                                    onClick={() => setDrawTool('pen')}
                                    style={{ width: '36px', height: '36px', background: drawTool === 'pen' ? '#e2e8f0' : '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '6px' }}
                                    title="Pen"
                                >
                                    <img src="/pen-icon.png" alt="Pen" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.8 }} />
                                </button>

                                <button
                                    onClick={() => setDrawTool('marker')}
                                    style={{ width: '36px', height: '36px', background: drawTool === 'marker' ? '#e2e8f0' : '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '6px' }}
                                    title="Marker"
                                >
                                    <img src="/marker-icon.png" alt="Marker" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.8 }} />
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
                    <button className="tool-btn" title="Filters"><img src="/filter-icon.png" alt="Filters" /><span className="tool-text">Filters</span></button>
                    <div className="tool-divider"></div>
                    <button className="tool-btn" title="History"><img src="/history-icon.png" alt="History" /><span className="tool-text">History</span></button>
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
                        />
                    </div>
                </main>

                <aside className="editor-sidebar-right">
                    <div className="properties-panel">

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
                                <h3>{selectedElement.type.toUpperCase()} PROPERTIES</h3>

                                {selectedElement.type === 'line' && (
                                    <>
                                        <div className="prop-group">
                                            <label>Line Color</label>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <input type="color" value={selectedElement.stroke} onChange={(e) => updateSelectedElement('stroke', e.target.value)} />
                                                <input type="text" value={selectedElement.stroke} onChange={(e) => updateSelectedElement('stroke', e.target.value)} style={{ flex: 1, textTransform: 'uppercase' }} />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {selectedElement.type === 'text' && (
                                    <>
                                        <div className="prop-group"><label>Text Content</label><textarea value={selectedElement.text} onChange={(e) => updateSelectedElement('text', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0', minHeight: '60px' }} /></div>
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

                                {selectedElement.type === 'shape' && (
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