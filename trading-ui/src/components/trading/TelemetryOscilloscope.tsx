import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

interface TelemetryOscilloscopeProps {
  data?: number[];
  color?: string;
  className?: string;
  height?: number;
}

export function TelemetryOscilloscope({
  data = [40, 60, 45, 70, 50, 65, 55, 80, 60, 75, 50, 45, 60, 55, 70, 65, 75, 85, 90, 80],
  color = "#00F5FF",
  className = "",
  height = 60
}: TelemetryOscilloscopeProps) {
  const points = useMemo(() => {
    const width = 200;
    const step = width / (data.length - 1);
    return data.map((val, i) => `${i * step},${height - (val / 100) * height}`).join(' ');
  }, [data, height]);

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ height: `${height}px`, width: '100%' }}>
      <svg
        viewBox={`0 0 200 ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        {/* Background Grid Lines */}
        <line x1="0" y1={height * 0.25} x2="200" y2={height * 0.25} stroke="white" strokeOpacity="0.05" strokeWidth="0.5" />
        <line x1="0" y1={height * 0.5} x2="200" y2={height * 0.5} stroke="white" strokeOpacity="0.05" strokeWidth="0.5" />
        <line x1="0" y1={height * 0.75} x2="200" y2={height * 0.75} stroke="white" strokeOpacity="0.05" strokeWidth="0.5" />

        {/* Glow Path */}
        <motion.polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeOpacity="0.5"
          filter="blur(4px)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
        />

        {/* Sharp Path */}
        <motion.polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1"
          className="animate-oscilloscope-flow"
          style={{ strokeDasharray: '200' }}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        />

        {/* Fill Area */}
        <motion.path
          d={`M 0,${height} ${points} L 200,${height} Z`}
          fill={`url(#glow-gradient-${color.replace('#', '')})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.15 }}
          transition={{ duration: 2 }}
        />

        <defs>
          <linearGradient id={`glow-gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {/* Scanning Line overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent w-20 animate-[move-x_3s_linear_infinite]" />

      <style>{`
        @keyframes move-x {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
