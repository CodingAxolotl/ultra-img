import { motion } from 'framer-motion';

const TAGS = [
  { label: '🏔️ Landscape', text: 'beautiful landscape, mountains, sunset, 4k, photorealistic' },
  { label: '🎨 Anime', text: 'anime style, vibrant colors, detailed illustration' },
  { label: '🌌 Space', text: 'outer space, nebula, stars, cosmic, cinematic lighting' },
  { label: '🏙️ Cyberpunk', text: 'cyberpunk city, neon lights, rain, futuristic, dark atmosphere' },
  { label: '🐉 Fantasy', text: 'fantasy art, magical, ethereal, detailed, epic' },
  { label: '📸 Portrait', text: 'portrait photography, studio lighting, sharp focus, professional' },
  { label: '🎮 Pixel Art', text: 'pixel art style, retro gaming, 16-bit, nostalgic' },
  { label: '🧱 Minecraft', text: 'minecraft style, blocky, voxel art, creeper, green theme' },
];

interface PromptTagsProps {
  onTagClick: (text: string) => void;
}

export function PromptTags({ onTagClick }: PromptTagsProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-3">
      <span className="text-[0.65rem] text-[#666] uppercase tracking-wider self-center mr-1" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '0.5rem' }}>
        Quick:
      </span>
      {TAGS.map((tag, i) => (
        <motion.button
          key={i}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onTagClick(tag.text)}
          className="px-2.5 py-1.5 text-[0.7rem] bg-[#1a1a1a] border border-[#333] text-[#aaa] hover:text-white hover:border-[#22c55e] hover:bg-[#22c55e10] transition-all cursor-pointer"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {tag.label}
        </motion.button>
      ))}
    </div>
  );
}
