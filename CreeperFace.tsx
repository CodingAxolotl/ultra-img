import { motion } from 'framer-motion';

export function CreeperFace({ size = 64, className = '' }: { size?: number; className?: string }) {
  const px = size / 8; // Each pixel unit

  // Creeper face pixel grid (8x8)
  // 0 = light green, 1 = dark green (features)
  const grid = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 0, 0, 1, 1, 0],
    [0, 1, 1, 0, 0, 1, 1, 0],
    [0, 0, 0, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 0, 1, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ];

  return (
    <motion.div
      className={className}
      style={{ width: size, height: size, imageRendering: 'pixelated' }}
      animate={{ scale: [1, 1.02, 1] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ imageRendering: 'pixelated' }}>
        {grid.map((row, y) =>
          row.map((cell, x) => (
            <rect
              key={`${x}-${y}`}
              x={x * px}
              y={y * px}
              width={px}
              height={px}
              fill={cell === 1 ? '#0a5c2a' : '#22c55e'}
            />
          ))
        )}
      </svg>
    </motion.div>
  );
}

export function CreeperFaceMini({ size = 24 }: { size?: number }) {
  const px = size / 8;
  const grid = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 0, 0, 1, 1, 0],
    [0, 1, 1, 0, 0, 1, 1, 0],
    [0, 0, 0, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 0, 1, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ imageRendering: 'pixelated' }}>
      {grid.map((row, y) =>
        row.map((cell, x) => (
          <rect
            key={`${x}-${y}`}
            x={x * px}
            y={y * px}
            width={px}
            height={px}
            fill={cell === 1 ? '#0a5c2a' : '#22c55e'}
          />
        ))
      )}
    </svg>
  );
}
