// ./frontend/src/components/Sparkline.js
import React from 'react';

/**
 * props:
 *  - data: [{date: 'YYYY-MM-DD', count: number}, ...] (ordered ascending)
 *  - width, height
 */
const Sparkline = ({ data = [], width = 200, height = 50 }) => {
    if (!data || data.length === 0) {
        return <svg width={width} height={height}><text x="10" y={height/2}>Нет данных</text></svg>;
    }

    const values = data.map(d => d.count);
    const max = Math.max(...values, 1);
    const min = Math.min(...values);

    const stepX = width / (values.length - 1 || 1);

    const points = values.map((v, i) => {
        const x = i * stepX;
        // invert y: larger value -> smaller y coordinate
        const y = height - ((v - min) / (max - min || 1)) * (height - 4) - 2;
        return `${x},${y}`;
    }).join(' ');

    // area for subtle fill
    const areaPoints = values.map((v, i) => {
        const x = i * stepX;
        const y = height - ((v - min) / (max - min || 1)) * (height - 4) - 2;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <polyline points={areaPoints} fill="none" stroke="rgba(139,92,246,0.15)" strokeWidth="0" />
            <polyline points={`${areaPoints} ${width},${height} 0,${height}`} fill="rgba(139,92,246,0.06)" stroke="none" />
            <polyline points={points} fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
};

export default Sparkline;
