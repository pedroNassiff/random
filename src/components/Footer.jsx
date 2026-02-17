import React from 'react';
import { useTranslation } from 'react-i18next';
import { Github, Linkedin, Mail } from 'lucide-react';

export default function Footer() {
  const { t } = useTranslation();
  
  return (
    <footer id="info" className="w-full bg-[#1A1A1A] px-6 md:px-16 py-12 md:py-[80px]">
      <div className="flex flex-col gap-10 max-w-[1600px] mx-auto">
        {/* Footer Top */}
        <div className="flex flex-col md:flex-row justify-between gap-8 md:gap-0 px-4">
          {/* Logo */}
          <div className="flex flex-col gap-4">
            <div className="text-xl font-semibold text-white font-geist-pixel">.RANDOM()</div>
          </div>

          {/* Links */}
          <div className="flex flex-col md:flex-row gap-8 md:gap-20">
            {/* Column 1 */}
            <div className="flex flex-col gap-4">
              <h4 className="text-sm font-semibold text-white">{t('footer.projects_title')}</h4>
              <a href="#proyectos" className="text-sm text-[#999999] hover:text-white transition-colors">
                {t('footer.work')}
              </a>
              <a href="#servicios" className="text-sm text-[#999999] hover:text-white transition-colors">
                {t('footer.services')}
              </a>
              <a href="#lab" className="text-sm text-[#999999] hover:text-white transition-colors">
                {t('footer.lab')}
              </a>
            </div>

            {/* Column 2 */}
            <div className="flex flex-col gap-4">
              <h4 className="text-sm font-semibold text-white">{t('footer.info_title')}</h4>
              <a href="#about" className="text-sm text-[#999999] hover:text-white transition-colors">
                {t('footer.about')}
              </a>
              <a href="mailto:nassiffpedro@gmail.com" className="text-sm text-[#999999] hover:text-white transition-colors">
                {t('footer.contact')}
              </a>
            </div>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-8 border-t border-[#333333] px-4">
          <p className="text-[13px] text-[#666666]">
            © 2026 .RANDOM() — {t('footer.rights')}
          </p>
          <div className="flex gap-6">
            <a href="https://github.com/pedroNassiff" target="_blank" rel="noopener noreferrer" className="text-[#999999] hover:text-white transition-colors">
              <Github className="w-5 h-5" />
            </a>
            <a href="https://www.linkedin.com/in/pedronassiff/" target="_blank" rel="noopener noreferrer" className="text-[#999999] hover:text-white transition-colors">
              <Linkedin className="w-5 h-5" />
            </a>
            <a href="mailto:nassiffpedro@gmail.com" className="text-[#999999] hover:text-white transition-colors">
              <Mail className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
