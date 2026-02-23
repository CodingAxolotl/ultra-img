import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          onClick={onClose}
          style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.85)' }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-[600px] max-h-[90vh] overflow-y-auto rounded-none border-2 border-[#333] bg-[#1a1a1a] p-6"
            onClick={(e) => e.stopPropagation()}
            style={{
              boxShadow:
                'inset -3px -3px 0px 0px rgba(0,0,0,0.3), inset 3px 3px 0px 0px rgba(255,255,255,0.05), 0 10px 40px rgba(0,0,0,0.5)',
            }}
          >
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-[#333]">
              <h3
                className="text-lg font-bold text-white"
                style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '0.8rem' }}
              >
                {title}
              </h3>
              <button
                onClick={onClose}
                className="text-[#888] hover:text-white transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
