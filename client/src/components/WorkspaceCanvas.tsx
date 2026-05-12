import { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Transformer, Text as KonvaText, Rect, Ellipse, RegularPolygon, Star, Line } from 'react-konva';

const useImageSource = (url: string) => {
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

const URLImage = ({ imageInfo, onSelect, onChange }: { imageInfo: any, isSelected: boolean, onSelect: () => void, onChange: (newProps: any) => void }) => {
    const [image] = useImageSource(imageInfo.src);
    const imageRef = useRef<any>(null);

    return (
        <KonvaImage
            id={imageInfo.id} ref={imageRef} image={image} x={imageInfo.x} y={imageInfo.y}
            width={imageInfo.width || 100} height={imageInfo.height || 100} draggable
            onClick={onSelect} onTap={onSelect}
            onDragEnd={(e) => onChange({ ...imageInfo, x: e.target.x(), y: e.target.y() })}
            onTransformEnd={(e) => {
                const node = e.target;
                onChange({
                    ...imageInfo, x: node.x(), y: node.y(),
                    width: Math.max(5, node.width() * node.scaleX()), height: Math.max(5, node.height() * node.scaleY()),
                });
                node.scaleX(1); node.scaleY(1);
            }}
        />
    );
};

const EditableText = ({ textInfo, isEditing, onSelect, onDoubleClick, onChange }: { textInfo: any, isEditing: boolean, onSelect: () => void, onDoubleClick: () => void, onChange: (newProps: any) => void }) => {
    const textRef = useRef<any>(null);
    return (
        <KonvaText
            id={textInfo.id} ref={textRef} text={textInfo.text} x={textInfo.x} y={textInfo.y}
            fontSize={textInfo.fontSize || 32} fill={textInfo.fill || '#000000'} width={textInfo.width}
            fontStyle={textInfo.fontStyle || 'normal'} textDecoration={textInfo.textDecoration || ''} align={textInfo.align || 'left'}
            draggable={!isEditing} opacity={isEditing ? 0 : 1}
            onClick={onSelect} onTap={onSelect} onDblClick={onDoubleClick} onDblTap={onDoubleClick}
            onDragEnd={(e) => onChange({ ...textInfo, x: e.target.x(), y: e.target.y() })}
            onTransformEnd={(e) => {
                const node = e.target;
                const scaleX = node.scaleX(); const scaleY = node.scaleY();
                node.scaleX(1); node.scaleY(1);
                onChange({
                    ...textInfo, x: node.x(), y: node.y(),
                    fontSize: Math.max(10, (textInfo.fontSize || 32) * scaleY), width: Math.max(10, node.width() * scaleX),
                });
            }}
        />
    );
};

const CanvasShape = ({ shapeInfo, onSelect, onChange }: { shapeInfo: any, isSelected: boolean, onSelect: () => void, onChange: (newProps: any) => void }) => {
    const shapeRef = useRef<any>(null);
    const isComplex = shapeInfo.shapeType === 'triangle' || shapeInfo.shapeType === 'star';

    const commonProps = {
        id: shapeInfo.id,
        ref: shapeRef,
        fill: shapeInfo.fill,
        draggable: true,
        onClick: onSelect,
        onTap: onSelect,
        onDragEnd: (e: any) => {
            const node = e.target;
            if (shapeInfo.shapeType === 'ellipse') {
                onChange({ ...shapeInfo, x: node.x() - shapeInfo.width / 2, y: node.y() - shapeInfo.height / 2 });
            } else {
                onChange({ ...shapeInfo, x: node.x(), y: node.y() });
            }
        },
        onTransformEnd: (e: any) => {
            const node = e.target;
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();

            if (!isComplex) {
                node.scaleX(1);
                node.scaleY(1);
                let newX = node.x(); let newY = node.y();

                if (shapeInfo.shapeType === 'ellipse') {
                    newX -= (node.width() * scaleX) / 2;
                    newY -= (node.height() * scaleY) / 2;
                }

                onChange({
                    ...shapeInfo, x: newX, y: newY,
                    width: Math.max(10, node.width() * scaleX), height: Math.max(10, node.height() * scaleY),
                });
            } else {
                onChange({
                    ...shapeInfo, x: node.x(), y: node.y(),
                    scaleX: scaleX, scaleY: scaleY,
                    width: Math.max(10, shapeInfo.baseWidth * scaleX), height: Math.max(10, shapeInfo.baseHeight * scaleY),
                });
            }
        }
    };

    if (shapeInfo.shapeType === 'rect') return <Rect {...commonProps} x={shapeInfo.x} y={shapeInfo.y} width={shapeInfo.width} height={shapeInfo.height} cornerRadius={shapeInfo.cornerRadius || 0} />;
    if (shapeInfo.shapeType === 'ellipse') {
        const rx = shapeInfo.width / 2; const ry = shapeInfo.height / 2;
        return <Ellipse radiusX={0} radiusY={0} {...commonProps} x={shapeInfo.x + rx} y={shapeInfo.y + ry}
                        width={shapeInfo.width} height={shapeInfo.height} />;
    }
    if (shapeInfo.shapeType === 'triangle') return <RegularPolygon {...commonProps} x={shapeInfo.x} y={shapeInfo.y} sides={3} radius={shapeInfo.baseWidth / 2 || 75} scaleX={shapeInfo.scaleX || 1} scaleY={shapeInfo.scaleY || 1} />;
    if (shapeInfo.shapeType === 'star') return <Star {...commonProps} x={shapeInfo.x} y={shapeInfo.y} numPoints={shapeInfo.numPoints || 5} outerRadius={shapeInfo.baseWidth / 2 || 75} innerRadius={shapeInfo.innerRadius || 35} scaleX={shapeInfo.scaleX || 1} scaleY={shapeInfo.scaleY || 1} />;

    return null;
};

const CanvasLine = ({ lineInfo, onSelect }: { lineInfo: any, onSelect: () => void }) => {
    const isEraser = lineInfo.tool === 'eraser';
    return (
        <Line
            id={lineInfo.id}
            points={lineInfo.points}
            stroke={lineInfo.stroke}
            strokeWidth={lineInfo.strokeWidth}
            tension={lineInfo.tension ?? 0.5}
            lineCap="round"
            lineJoin="round"
            globalCompositeOperation={isEraser ? 'destination-out' : 'source-over'}
            draggable={!isEraser}
            listening={!isEraser}
            onClick={onSelect}
            onTap={onSelect}
        />
    );
};

export default function WorkspaceCanvas({
                                            width, height, elements, setElements, selectedId, setSelectedId,
                                            mode, drawTool, drawColor, drawSize
                                        }: {
    width: number, height: number, elements: any[], setElements: any,
    selectedId: string | null, setSelectedId: (id: string | null) => void,
    mode?: string, drawTool?: string, drawColor?: string, drawSize?: number
}) {
    const stageRef = useRef<any>(null);
    const trRef = useRef<any>(null);
    const [editingTextId, setEditingTextId] = useState<string | null>(null);
    const isDrawing = useRef(false);

    useEffect(() => {
        if (trRef.current) {
            if (mode !== 'draw' && selectedId && selectedId !== editingTextId) {
                const selectedNode = stageRef.current.findOne('#' + selectedId);
                // Забороняємо виділяти лінії рамочкою Transformer
                if (selectedNode && selectedNode.className !== 'Line') {
                    trRef.current.nodes([selectedNode]);
                    trRef.current.getLayer().batchDraw();
                } else {
                    trRef.current.nodes([]);
                }
            } else {
                trRef.current.nodes([]);
            }
        }
    }, [selectedId, elements, editingTextId, mode]);

    const handleMouseDown = (e: any) => {
        if (mode !== 'draw') {
            if (e.target === e.target.getStage()) { setSelectedId(null); setEditingTextId(null); }
            return;
        }

        isDrawing.current = true;
        const pos = e.target.getStage().getPointerPosition();

        const newLine = {
            id: Date.now().toString(),
            type: 'line',
            tool: drawTool,
            points: [pos.x, pos.y],
            // Гумка завжди має щільний колір (щоб пробивати дірку)
            stroke: drawTool === 'eraser' ? '#000000' : drawColor,
            strokeWidth: drawSize,
        };

        if (drawTool === 'marker') {
            const hex = drawColor?.replace('#', '') || '000000';
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            newLine.stroke = `rgba(${r},${g},${b},0.3)`;
            (newLine as any).tension = 0;
        }

        setElements([...elements, newLine]);
    };

    const handleMouseMove = (e: any) => {
        if (!isDrawing.current || mode !== 'draw') return;

        const stage = e.target.getStage();
        const point = stage.getPointerPosition();

        setElements((prev: any[]) => {
            const lastLine = { ...prev[prev.length - 1] };
            lastLine.points = lastLine.points.concat([point.x, point.y]);

            const newElements = [...prev];
            newElements[prev.length - 1] = lastLine;
            return newElements;
        });
    };

    const handleMouseUp = () => {
        isDrawing.current = false;
    };

    const handleElementChange = (index: number, newProps: any) => {
        const newElements = [...elements]; newElements[index] = newProps; setElements(newElements);
    };

    const editingElement = elements.find(el => el.id === editingTextId);

    return (
        <>
            <Stage
                width={width} height={height} ref={stageRef}
                onMouseDown={handleMouseDown} onMousemove={handleMouseMove} onMouseup={handleMouseUp}
                onTouchStart={handleMouseDown} onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp}
            >
                <Layer>
                    {elements.map((el, i) => {
                        if (el.type === 'image') return <URLImage key={el.id} imageInfo={el} isSelected={el.id === selectedId} onSelect={() => setSelectedId(el.id)} onChange={(newProps) => handleElementChange(i, newProps)} />;
                        if (el.type === 'text') return <EditableText key={el.id} textInfo={el} isEditing={el.id === editingTextId} onSelect={() => { setSelectedId(el.id); if (editingTextId !== el.id) setEditingTextId(null); }} onDoubleClick={() => setEditingTextId(el.id)} onChange={(newProps) => handleElementChange(i, newProps)} />;
                        if (el.type === 'shape') return <CanvasShape key={el.id} shapeInfo={el} isSelected={el.id === selectedId} onSelect={() => { setSelectedId(el.id); setEditingTextId(null); }} onChange={(newProps) => handleElementChange(i, newProps)} />;
                        if (el.type === 'line') return <CanvasLine key={el.id} lineInfo={el} onSelect={() => { if (mode !== 'draw') setSelectedId(el.id); }} />;
                        return null;
                    })}
                    <Transformer ref={trRef} borderDash={[6, 2]} keepRatio={false} />
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
                        position: 'absolute', top: editingElement.y, left: editingElement.x, width: editingElement.width, height: editingElement.fontSize * 1.2 * editingElement.text.split('\n').length + 20,
                        fontSize: `${editingElement.fontSize}px`, color: editingElement.fill, fontWeight: editingElement.fontStyle?.includes('bold') ? 'bold' : 'normal',
                        fontStyle: editingElement.fontStyle?.includes('italic') ? 'italic' : 'normal', textDecoration: editingElement.textDecoration || 'none', textAlign: editingElement.align || 'left',
                        border: '1px dashed black', padding: '0px', margin: '0px', background: 'transparent', outline: 'none', resize: 'none', lineHeight: 1.2, fontFamily: 'Arial', overflow: 'hidden', zIndex: 10,
                    }}
                />
            )}
        </>
    );
}