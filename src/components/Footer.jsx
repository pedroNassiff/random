import React from 'react';
import { Github, Linkedin, Mail } from 'lucide-react';

export default function Footer() {
  return (
    <footer id="info" className="w-full bg-[#1A1A1A] px-16 py-[80px]">
      <div className="flex flex-col gap-10 max-w-[1600px] mx-auto">
        {/* Footer Top */}
        <div className="flex justify-between px-4">
          <div className="flex flex-col gap-4">
            <div className="text-xl font-semibold text-white">.RANDOM()</div>
          </div>

          <div className="flex gap-20">
            {/* Column 1 */}
            <div className="flex flex-col gap-4">
              <h4 className="text-sm font-semibold text-white">Proyectos</h4>
              <a href="#" className="text-sm text-[#999999] hover:text-white transition-colors">
                Modelado 3D
              </a>
              <a href="#" className="text-sm text-[#999999] hover:text-white transition-colors">
                IA
              </a>
              <a href="#" className="text-sm text-[#999999] hover:text-white transition-colors">
                Web
              </a>
            </div>

            {/* Column 2 */}
            <div className="flex flex-col gap-4">
              <h4 className="text-sm font-semibold text-white">Info</h4>
              <a href="#" className="text-sm text-[#999999] hover:text-white transition-colors">
                Sobre mí
              </a>
              <a href="#" className="text-sm text-[#999999] hover:text-white transition-colors">
                Proceso
              </a>
              <a href="#" className="text-sm text-[#999999] hover:text-white transition-colors">
                Contacto
              </a>
            </div>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="flex items-center justify-between pt-8 border-t border-[#333333] px-4">
          <p className="text-[13px] text-[#666666]">
            © 2026 .RANDOM() — Todos los derechos reservados
          </p>
          <div className="flex gap-6">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-[#999999] hover:text-white transition-colors">
              <Github className="w-5 h-5" />
            </a>
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-[#999999] hover:text-white transition-colors">
              <Linkedin className="w-5 h-5" />
            </a>
            <a href="mailto:contact@random.com" className="text-[#999999] hover:text-white transition-colors">
              <Mail className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
