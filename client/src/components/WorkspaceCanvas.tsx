import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Transformer, Text as KonvaText, Rect, Ellipse, RegularPolygon, Star, Line, Arrow, Group } from 'react-konva';
import Konva from 'konva';

export interface CanvasElementProps {
    id: string;
    type: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    src?: string;
    text?: string;
    fontSize?: number;
    fontFamily?: string;
    fontStyle?: string;
    textDecoration?: string;
    align?: string;
    shapeType?: string;
    cornerRadius?: number;
    baseWidth?: number;
    baseHeight?: number;
    numPoints?: number;
    innerRadius?: number;
    scaleX?: number;
    scaleY?: number;
    rotation?: number;
    tool?: string;
    points?: number[];
    tension?: number;
    dash?: number[];
    filter?: string | null;
    status?: string;
    message?: string;
}

const useImageSource = (url?: string): [HTMLImageElement | undefined] => {
    const [image, setImage] = useState<HTMLImageElement | undefined>(undefined);
    useEffect(() => {
        if (!url) return;
        const img = new window.Image();
        img.crossOrigin = 'Anonymous';
        img.src = url;
        img.onload = () => setImage(img);
    }, [url]);
    return [image];
};

const getSnappingPos = (pos: Konva.Vector2d, canvasWidth: number, canvasHeight: number, el: CanvasElementProps) => {
    const stageWidthCenter = canvasWidth / 2;
    const stageHeightCenter = canvasHeight / 2;
    const snapThreshold = 10;

    let snappedX = pos.x;
    let snappedY = pos.y;
    const newGuides: { points: number[] }[] = [];

    const isCenterOrigin = el.shapeType === 'ellipse' || el.shapeType === 'triangle' || el.shapeType === 'star';
    const elWidth = el.width || (el.baseWidth ? el.baseWidth * (el.scaleX || 1) : 100);
    const elHeight = el.height || (el.baseHeight ? el.baseHeight * (el.scaleY || 1) : 100);

    const offsetX = isCenterOrigin ? 0 : elWidth / 2;
    const offsetY = isCenterOrigin ? 0 : elHeight / 2;

    const centerX = pos.x + offsetX;
    const centerY = pos.y + offsetY;

    if (Math.abs(centerY - stageHeightCenter) < snapThreshold) {
        snappedY = stageHeightCenter - offsetY;
        newGuides.push({ points: [0, stageHeightCenter, canvasWidth, stageHeightCenter] });
    }

    if (Math.abs(centerX - stageWidthCenter) < snapThreshold) {
        snappedX = stageWidthCenter - offsetX;
        newGuides.push({ points: [stageWidthCenter, 0, stageWidthCenter, canvasHeight] });
    }

    return { pos: { x: snappedX, y: snappedY }, guides: newGuides };
};

const CanvasPlaceholder = ({ info, onSelect, onChange, dragBoundFunc }: {
    info: CanvasElementProps, onSelect: () => void, onChange: (newProps: CanvasElementProps) => void, dragBoundFunc?: (pos: Konva.Vector2d) => Konva.Vector2d
}) => {
    const [loadingGif] = useImageSource('/loading.gif');
    const groupRef = useRef<Konva.Group>(null);

    return (
        <Group
            id={info.id} ref={groupRef} x={info.x} y={info.y} draggable
            onClick={onSelect} onTap={onSelect}
            dragBoundFunc={dragBoundFunc}
            onDragEnd={(e: Konva.KonvaEventObject<Event>) => onChange({ ...info, x: e.target.x(), y: e.target.y() })}
        >
            <Rect width={info.width || 200} height={info.height || 200} fill="#e6e1dd" stroke={info.status === 'error' ? '#ef4444' : '#274D69'} strokeWidth={2} dash={[8, 4]} cornerRadius={8} />
            {info.status === 'loading' && (
                <>
                    {loadingGif && <KonvaImage image={loadingGif} x={(info.width || 200) / 2 - 24} y={(info.height || 200) / 2 - 24} width={48} height={48} />}
                    <KonvaText text="Uploading..." x={0} y={(info.height || 200) / 2 + 30} width={info.width || 200} align="center" fill="#6C8CAB" fontSize={14} fontFamily="Arial" fontStyle="bold" />
                </>
            )}
            {info.status === 'error' && <KonvaText text={info.message || 'Error'} x={0} y={(info.height || 200) / 2 - 10} width={info.width || 200} align="center" fill="#ef4444" fontSize={14} fontFamily="Arial" fontStyle="bold" />}
        </Group>
    );
};

const URLImage = ({ imageInfo, onSelect, onChange, dragBoundFunc }: {
    imageInfo: CanvasElementProps, isSelected: boolean, onSelect: () => void, onChange: (newProps: CanvasElementProps) => void, dragBoundFunc?: (pos: Konva.Vector2d) => Konva.Vector2d
}) => {
    const [image] = useImageSource(imageInfo.src);
    const imageRef = useRef<Konva.Image>(null);

    useEffect(() => {
        if (image && imageRef.current) {
            const node = imageRef.current;
            const prevRot = node.rotation();
            node.rotation(0);

            if (imageInfo.filter) {
                node.cache();
            } else {
                node.clearCache();
            }

            node.rotation(prevRot);
            const layer = node.getLayer();
            if (layer) layer.batchDraw();
        }
    }, [image, imageInfo.filter, imageInfo.width, imageInfo.height]);

    const getFilters = () => {
        if (!imageInfo.filter) return [];
        const filtersMap: Record<string, any> = { 'Grayscale': Konva.Filters.Grayscale, 'Sepia': Konva.Filters.Sepia, 'Invert': Konva.Filters.Invert, 'Blur': Konva.Filters.Blur, 'Brighten': Konva.Filters.Brighten };
        const selectedFilter = filtersMap[imageInfo.filter];
        return selectedFilter ? [selectedFilter] : [];
    };

    return (
        <KonvaImage
            id={imageInfo.id} ref={imageRef} image={image} x={imageInfo.x} y={imageInfo.y}
            width={imageInfo.width || (image ? image.width : 100)} height={imageInfo.height || (image ? image.height : 100)}
            draggable dragBoundFunc={dragBoundFunc}
            filters={getFilters()} blurRadius={imageInfo.filter === 'Blur' ? 10 : 0} brightness={imageInfo.filter === 'Brighten' ? 0.5 : 0}

            rotation={imageInfo.rotation || 0}

            onClick={onSelect} onTap={onSelect}
            onDragEnd={(e: Konva.KonvaEventObject<Event>) => onChange({ ...imageInfo, x: e.target.x(), y: e.target.y() })}
            onTransformEnd={(e: Konva.KonvaEventObject<Event>) => {
                const node = e.target as Konva.Node;
                const newWidth = Math.max(5, node.width() * node.scaleX());
                const newHeight = Math.max(5, node.height() * node.scaleY());
                node.scaleX(1);
                node.scaleY(1);

                onChange({
                    ...imageInfo,
                    x: node.x(),
                    y: node.y(),
                    width: newWidth,
                    height: newHeight,
                    rotation: node.rotation()
                });
            }}
        />
    );
};

const EditableText = ({ textInfo, isEditing, onSelect, onDoubleClick, onChange, dragBoundFunc }: {
    textInfo: CanvasElementProps, isEditing: boolean, onSelect: () => void, onDoubleClick: () => void, onChange: (newProps: CanvasElementProps) => void, dragBoundFunc?: (pos: Konva.Vector2d) => Konva.Vector2d
}) => {
    const textRef = useRef<Konva.Text>(null);
    return (
        <KonvaText
            id={textInfo.id} ref={textRef} text={textInfo.text} x={textInfo.x} y={textInfo.y}
            fontSize={textInfo.fontSize || 32} fill={textInfo.fill || '#000000'} width={textInfo.width}
            fontFamily={textInfo.fontFamily || 'Arial'} fontStyle={textInfo.fontStyle || 'normal'} textDecoration={textInfo.textDecoration || ''} align={textInfo.align || 'left'}
            draggable={!isEditing} opacity={isEditing ? 0 : 1}
            dragBoundFunc={dragBoundFunc}

            rotation={textInfo.rotation || 0}

            onClick={onSelect} onTap={onSelect} onDblClick={onDoubleClick} onDblTap={onDoubleClick}
            onDragEnd={(e: Konva.KonvaEventObject<Event>) => onChange({ ...textInfo, x: e.target.x(), y: e.target.y() })}
            onTransformEnd={(e: Konva.KonvaEventObject<Event>) => {
                const node = e.target as Konva.Node;
                const scaleX = node.scaleX(); const scaleY = node.scaleY();
                node.scaleX(1); node.scaleY(1);
                onChange({
                    ...textInfo,
                    x: node.x(),
                    y: node.y(),
                    fontSize: Math.max(10, (textInfo.fontSize || 32) * scaleY),
                    width: Math.max(10, node.width() * scaleX),
                    rotation: node.rotation()
                });
            }}
        />
    );
};

const CanvasShape = ({ shapeInfo, onSelect, onChange, dragBoundFunc }: {
    shapeInfo: CanvasElementProps, isSelected: boolean, onSelect: () => void, onChange: (newProps: CanvasElementProps) => void, dragBoundFunc?: (pos: Konva.Vector2d) => Konva.Vector2d
}) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shapeRef = useRef<any>(null);
    const isComplex = shapeInfo.shapeType === 'triangle' || shapeInfo.shapeType === 'star';

    const commonProps = {
        id: shapeInfo.id, ref: shapeRef, fill: shapeInfo.fill, draggable: true,
        onClick: onSelect, onTap: onSelect,
        dragBoundFunc: dragBoundFunc,

        rotation: shapeInfo.rotation || 0,

        onDragEnd: (e: Konva.KonvaEventObject<Event>) => {
            const node = e.target as Konva.Node;
            if (shapeInfo.shapeType === 'ellipse') { onChange({ ...shapeInfo, x: node.x() - (shapeInfo.width || 0) / 2, y: node.y() - (shapeInfo.height || 0) / 2 }); }
            else { onChange({ ...shapeInfo, x: node.x(), y: node.y() }); }
        },
        onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
            const node = e.target as Konva.Node;
            const scaleX = node.scaleX(); const scaleY = node.scaleY();
            if (!isComplex) {
                node.scaleX(1); node.scaleY(1);
                let newX = node.x(); let newY = node.y();
                if (shapeInfo.shapeType === 'ellipse') { newX -= (node.width() * scaleX) / 2; newY -= (node.height() * scaleY) / 2; }

                onChange({
                    ...shapeInfo, x: newX, y: newY,
                    width: Math.max(10, node.width() * scaleX),
                    height: Math.max(10, node.height() * scaleY),
                    rotation: node.rotation()
                });
            } else {
                onChange({
                    ...shapeInfo, x: node.x(), y: node.y(),
                    scaleX: scaleX, scaleY: scaleY,
                    width: Math.max(10, (shapeInfo.baseWidth || 150) * scaleX),
                    height: Math.max(10, (shapeInfo.baseHeight || 150) * scaleY),
                    rotation: node.rotation()
                });
            }
        }
    };

    if (shapeInfo.shapeType === 'rect') return <Rect {...commonProps} x={shapeInfo.x} y={shapeInfo.y} width={shapeInfo.width} height={shapeInfo.height} cornerRadius={shapeInfo.cornerRadius || 0} />;
    if (shapeInfo.shapeType === 'ellipse') return <Ellipse radiusX={0} radiusY={0} {...commonProps} x={(shapeInfo.x || 0) + (shapeInfo.width || 100) / 2} y={(shapeInfo.y || 0) + (shapeInfo.height || 100) / 2} width={shapeInfo.width} height={shapeInfo.height} />;
    if (shapeInfo.shapeType === 'triangle') return <RegularPolygon {...commonProps} x={shapeInfo.x} y={shapeInfo.y} sides={3} radius={(shapeInfo.baseWidth || 150) / 2} scaleX={shapeInfo.scaleX || 1} scaleY={shapeInfo.scaleY || 1} />;
    if (shapeInfo.shapeType === 'star') return <Star {...commonProps} x={shapeInfo.x} y={shapeInfo.y} numPoints={shapeInfo.numPoints || 5} outerRadius={(shapeInfo.baseWidth || 150) / 2} innerRadius={shapeInfo.innerRadius || 35} scaleX={shapeInfo.scaleX || 1} scaleY={shapeInfo.scaleY || 1} />;
    return null;
};

const CanvasLine = ({ lineInfo, onSelect }: { lineInfo: CanvasElementProps, onSelect: () => void }) => {
    const isEraser = lineInfo.tool === 'eraser';
    const isArrow = lineInfo.tool === 'arrow';

    const commonProps = {
        id: lineInfo.id, points: lineInfo.points || [], stroke: lineInfo.stroke, strokeWidth: lineInfo.strokeWidth, tension: lineInfo.tool === 'pen' ? 0.5 : 0, lineCap: "round" as any, lineJoin: "round" as any,
        draggable: !isEraser, listening: !isEraser, onClick: onSelect, onTap: onSelect, dash: lineInfo.dash,
    };

    if (isArrow) return <Arrow {...commonProps} fill={lineInfo.stroke} pointerLength={10} pointerWidth={10} />;
    return <Line {...commonProps} globalCompositeOperation={isEraser ? 'destination-out' : 'source-over'} />;
};

export default function WorkspaceCanvas({
                                            width, height, elements, setElements, selectedId, setSelectedId,
                                            mode, drawTool, drawColor, drawSize, onStageReady, showGrid
                                        }: {
    width: number, height: number, elements: CanvasElementProps[], setElements: React.Dispatch<React.SetStateAction<CanvasElementProps[]>>,
    selectedId: string | null, setSelectedId: (id: string | null) => void,
    mode?: string, drawTool?: string, drawColor?: string, drawSize?: number,
    onStageReady?: (stage: any) => void,
    showGrid?: boolean
}) {
    const stageRef = useRef<Konva.Stage>(null);
    const trRef = useRef<Konva.Transformer>(null);
    const [editingTextId, setEditingTextId] = useState<string | null>(null);
    const isDrawing = useRef(false);

    const clipboardRef = useRef<CanvasElementProps | null>(null);

    const [guides, setGuides] = useState<{ points: number[] }[]>([]);

    const [stageScale, setStageScale] = useState(1);
    const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        if (trRef.current) {
            if (mode !== 'draw' && selectedId && selectedId !== editingTextId) {
                const selectedNode = stageRef.current?.findOne('#' + selectedId);
                if (selectedNode && selectedNode.className !== 'Line' && selectedNode.className !== 'Group') {
                    trRef.current.nodes([selectedNode as Konva.Node]);
                    trRef.current.getLayer()?.batchDraw();
                } else { trRef.current.nodes([]); }
            } else { trRef.current.nodes([]); }
        }
    }, [selectedId, elements, editingTextId, mode]);

    useEffect(() => { if (onStageReady && stageRef.current) onStageReady(stageRef.current); }, [onStageReady]);

    const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
        if (mode !== 'draw') {
            if (e.target === e.target.getStage()) {
                setSelectedId(null);
                setEditingTextId(null);
            }
            return;
        }
        const stage = e.target.getStage();
        const pos = stage?.getPointerPosition();
        if (!pos) return;

        isDrawing.current = true;

        const x = (pos.x - stagePos.x) / stageScale;
        const y = (pos.y - stagePos.y) / stageScale;

        const currentTool = drawTool ?? 'pen';
        const currentColor = drawColor ?? '#000000';
        const currentSize = drawSize ?? 5;

        const newLine: CanvasElementProps = {
            id: Date.now().toString(), type: 'line', tool: currentTool,
            points: ['line', 'arrow', 'dashed'].includes(currentTool) ? [x, y, x, y] : [x, y],
            stroke: currentColor, strokeWidth: currentSize, dash: currentTool === 'dashed' ? [15, 10] : []
        };
        setElements([...elements, newLine]);
    };

    const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
        if (!isDrawing.current || mode !== 'draw') return;
        const stage = e.target.getStage();
        const pos = stage?.getPointerPosition();
        if (!pos) return;

        const x = (pos.x - stagePos.x) / stageScale;
        const y = (pos.y - stagePos.y) / stageScale;

        setElements((prev: CanvasElementProps[]) => {
            const lastLine = { ...prev[prev.length - 1] };
            if (['line', 'arrow', 'dashed'].includes(lastLine.tool || '')) {
                lastLine.points = [(lastLine.points || [])[0], (lastLine.points || [])[1], x, y];
            } else {
                lastLine.points = (lastLine.points || []).concat([x, y]);
            }
            const newElements = [...prev]; newElements[prev.length - 1] = lastLine;
            return newElements;
        });
    };

    const handleMouseUp = () => { isDrawing.current = false; };
    const handleElementChange = (index: number, newProps: CanvasElementProps) => { const newElements = [...elements]; newElements[index] = newProps; setElements(newElements); };

    const calculateDragBound = (pos: Konva.Vector2d, index: number) => {
        const el = elements[index];

        if (showGrid) {
            setGuides((prev) => prev.length > 0 ? [] : prev);
            return {
                x: Math.round(pos.x / 20) * 20,
                y: Math.round(pos.y / 20) * 20
            };
        }

        const { pos: snappedPos, guides: newGuides } = getSnappingPos(pos, width, height, el);

        setGuides((prev) => {
            if (prev.length !== newGuides.length) return newGuides;
            for(let i=0; i<prev.length; i++) {
                if (prev[i].points.join(',') !== newGuides[i].points.join(',')) return newGuides;
            }
            return prev;
        });

        return snappedPos;
    };

    const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
        e.evt.preventDefault();

        const stage = stageRef.current;
        if (!stage) return;

        const scaleBy = 1.1;
        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();

        if (!pointer) return;

        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };

        const direction = e.evt.deltaY > 0 ? -1 : 1;
        const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

        if (newScale < 0.1 || newScale > 5) return;

        setStageScale(newScale);

        setStagePos({
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        });
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            if (e.key === 'Escape') {
                setSelectedId(null);
                setEditingTextId(null);
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
                if (selectedId) {
                    const elToCopy = elements.find(el => el.id === selectedId);
                    if (elToCopy) {
                        clipboardRef.current = { ...elToCopy };
                    }
                }
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
                if (clipboardRef.current) {
                    const newId = Date.now().toString();
                    const pastedElement = {
                        ...clipboardRef.current,
                        id: newId,
                        x: (clipboardRef.current.x || 0) + 20,
                        y: (clipboardRef.current.y || 0) + 20,
                    };

                    clipboardRef.current = pastedElement;

                    setElements(prev => [...prev, pastedElement]);
                    setSelectedId(newId);
                }
                return;
            }

            if (!selectedId) return;

            if (e.key === 'Delete' || e.key === 'Backspace') {
                setElements(prev => prev.filter(el => el.id !== selectedId));
                setSelectedId(null);
                return;
            }

            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                const step = e.shiftKey ? 10 : 1;

                setElements(prev => prev.map(el => {
                    if (el.id === selectedId) {
                        return {
                            ...el,
                            x: (el.x || 0) + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0),
                            y: (el.y || 0) + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0),
                        };
                    }
                    return el;
                }));
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [selectedId, setElements, setSelectedId, elements]);

    const editingElement = elements.find(el => el.id === editingTextId);
    const selectedElement = elements.find(el => el.id === selectedId);

    return (
        <>
            <Stage
                width={width} height={height} ref={stageRef}
                scaleX={stageScale}
                scaleY={stageScale}
                x={stagePos.x}
                y={stagePos.y}
                onWheel={handleWheel}

                onMouseDown={handleMouseDown} onMousemove={handleMouseMove} onMouseup={handleMouseUp}
                onTouchStart={handleMouseDown} onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp}
            >
                <Layer>
                    {elements.map((el, i) => {
                        if (el.type === 'placeholder') return <CanvasPlaceholder key={el.id} info={el} onSelect={() => setSelectedId(el.id)} dragBoundFunc={(pos) => calculateDragBound(pos, i)} onChange={(newProps) => { handleElementChange(i, newProps); setGuides([]); }} />;
                        if (el.type === 'image') return <URLImage key={el.id} imageInfo={el} isSelected={el.id === selectedId} onSelect={() => setSelectedId(el.id)} dragBoundFunc={(pos) => calculateDragBound(pos, i)} onChange={(newProps) => { handleElementChange(i, newProps); setGuides([]); }} />;
                        if (el.type === 'text') return <EditableText key={el.id} textInfo={el} isEditing={el.id === editingTextId} onSelect={() => { setSelectedId(el.id); if (editingTextId !== el.id) setEditingTextId(null); }} onDoubleClick={() => setEditingTextId(el.id)} dragBoundFunc={(pos) => calculateDragBound(pos, i)} onChange={(newProps) => { handleElementChange(i, newProps); setGuides([]); }} />;
                        if (el.type === 'shape') return <CanvasShape key={el.id} shapeInfo={el} isSelected={el.id === selectedId} onSelect={() => { setSelectedId(el.id); setEditingTextId(null); }} dragBoundFunc={(pos) => calculateDragBound(pos, i)} onChange={(newProps) => { handleElementChange(i, newProps); setGuides([]); }} />;
                        if (el.type === 'line') return <CanvasLine key={el.id} lineInfo={el} onSelect={() => { if (mode !== 'draw') setSelectedId(el.id); }} />;
                        return null;
                    })}

                    <Transformer
                        ref={trRef}
                        borderDash={[6, 2]}
                        keepRatio={selectedElement?.type === 'image'}
                        enabledAnchors={
                            selectedElement?.type === 'image'
                                ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
                                : ['top-left', 'top-center', 'top-right', 'middle-right', 'bottom-right', 'bottom-center', 'bottom-left', 'middle-left']
                        }
                    />

                    {guides.length > 0 && (
                        <>
                            {guides.map((g, i) => (
                                <Line
                                    key={`guide-${i}`}
                                    points={g.points}
                                    stroke="#555"
                                    strokeWidth={1}
                                    dash={[4, 4]}
                                    listening={false}
                                />
                            ))}
                        </>
                    )}
                </Layer>
            </Stage>

            {editingElement && (
                <textarea
                    value={editingElement.text}
                    onChange={(e) => { const index = elements.findIndex(el => el.id === editingTextId); handleElementChange(index, { ...editingElement, text: e.target.value }); }}
                    onBlur={() => setEditingTextId(null)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) setEditingTextId(null); }}
                    autoFocus
                    style={{
                        position: 'absolute',
                        top: (editingElement.y || 0) * stageScale + stagePos.y,
                        left: (editingElement.x || 0) * stageScale + stagePos.x,
                        width: (editingElement.width || 100) * stageScale,
                        height: ((editingElement.fontSize || 32) * 1.2 * (editingElement.text?.split('\n').length || 1) + 20) * stageScale,
                        fontSize: `${(editingElement.fontSize || 32) * stageScale}px`,
                        color: editingElement.fill, fontWeight: editingElement.fontStyle?.includes('bold') ? 'bold' : 'normal',
                        fontStyle: editingElement.fontStyle?.includes('italic') ? 'italic' : 'normal', textDecoration: editingElement.textDecoration || 'none', textAlign: (editingElement.align as any) || 'left',
                        border: '1px dashed black', padding: '0px', margin: '0px', background: 'transparent', outline: 'none', resize: 'none', lineHeight: 1.2, fontFamily: editingElement.fontFamily || 'Arial', overflow: 'hidden', zIndex: 10,
                    }}
                />
            )}
        </>
    );
}