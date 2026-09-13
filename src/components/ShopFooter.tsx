import React, { useEffect, useState } from 'react';
import { Instagram, Music2, Facebook, Youtube } from 'lucide-react';
import { getStoreSettings, type FooterSettings } from '../data/storeSettings';
import { recordConsent } from '../data/consent';

const FONT = "'Helvetica Neue', Arial, sans-serif";

const DEFAULT_FOOTER: FooterSettings = {
  email: '',
  phone: '',
  copyright: '© NOTORIOUS.Y2',
  social: { instagram: '', tiktok: '', facebook: '', youtube: '' },
};

const ShopFooter: React.FC = () => {
  const [settings, setSettings] = useState<FooterSettings>(DEFAULT_FOOTER);
  const [newsletterEmail, setNewsletterEmail] = useState('');
const [subscribeStatus, setSubscribeStatus] =
  useState<'idle' | 'loading' | 'done' | 'error'>('idle');

const handleNewsletterSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!newsletterEmail.trim() || subscribeStatus === 'loading') return;

  setSubscribeStatus('loading');
  try {
    await recordConsent({
      userId: null,
      email: newsletterEmail.trim().toLowerCase(),
      consentType: 'marketing_email',
      granted: true,
      source: 'footer_signup',
    });
    setSubscribeStatus('done');
    setNewsletterEmail('');
  } catch (err) {
    console.error('Failed to save newsletter signup:', err);
    setSubscribeStatus('error');
  }
};

  useEffect(() => {
    let cancelled = false;
    getStoreSettings()
      .then(s => { if (!cancelled) setSettings(s.footer_settings); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <footer className="bg-white bg-opacity-95 backdrop-blur-sm border-t border-gray-100 px-2 sm:px-4" style={{ fontFamily: FONT }}>
      <div className="max-w-7xl mx-auto py-1 sm:py-2 md:py-6">
        {/* Task 2: grid-cols-3 unconditionally — same layout on mobile, just smaller */}
        <div className="grid grid-cols-3 gap-1 sm:gap-3 md:gap-6 mb-1 sm:mb-2 md:mb-4">

          {/* NEWSLETTER */}
          <div>
            <h3 className="text-[10px] sm:text-xs font-medium mb-1 sm:mb-2 md:mb-3 tracking-[0.05em] sm:tracking-[0.1em]">
              JOIN OUR MAIL LIST
            </h3>
            <form onSubmit={handleNewsletterSubmit} className="flex">
  <input
    type="email"
    required
    value={newsletterEmail}
    onChange={e => setNewsletterEmail(e.target.value)}
    placeholder="Enter your email"
    className="flex-1 min-w-0 px-1 sm:px-2 md:px-3 py-0.5 sm:py-1 md:py-2 text-[9px] sm:text-xs border border-gray-300 rounded-l-md focus:outline-none focus:border-black"
  />
  <button
    type="submit"
    disabled={subscribeStatus === 'loading'}
    className="px-1 sm:px-2 md:px-4 py-0.5 sm:py-1 md:py-2 bg-black text-white text-[9px] sm:text-xs rounded-r-md hover:bg-gray-800 transition-colors whitespace-nowrap disabled:opacity-50"
  >
    {subscribeStatus === 'done' ? 'Subscribed!' : subscribeStatus === 'loading' ? '...' : 'Subscribe'}
  </button>
</form>
{subscribeStatus === 'error' && (
  <p className="text-[9px] text-red-500 mt-1">Something went wrong — try again.</p>
)}
          </div>

          {/* SOCIAL — always shown, same icon set at every breakpoint */}
          <div className="flex flex-col items-center text-center">
            <h3 className="text-[10px] sm:text-xs font-medium mb-1 sm:mb-2 md:mb-3 tracking-[0.05em] sm:tracking-[0.1em]">
              FOLLOW US
            </h3>
            <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-3 justify-center">
              <a href={settings.social.youtube || '#'} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-red-600 transition-colors" aria-label="YouTube">
                <svg className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
              <a href={settings.social.tiktok || '#'} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-black transition-colors" aria-label="TikTok">
                <Music2 size={14} className="sm:w-4 sm:h-4 md:w-5 md:h-5" />
              </a>
              <a href={settings.social.facebook || '#'} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-blue-600 transition-colors" aria-label="Facebook">
                <Facebook size={14} className="sm:w-4 sm:h-4 md:w-5 md:h-5" />
              </a>
              <a href={settings.social.instagram || '#'} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-pink-600 transition-colors" aria-label="Instagram">
                <Instagram size={14} className="sm:w-4 sm:h-4 md:w-5 md:h-5" />
              </a>
              <a href="https://twitter.com/@notoriY2" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-blue-400 transition-colors" aria-label="Twitter">
                <svg className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                </svg>
              </a>
              <a href="https://pinterest.com/notoriy2" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-red-500 transition-colors" aria-label="Pinterest">
                <svg className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.174-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24.009 12.017 24.009c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001.012.001z" />
                </svg>
              </a>
            </div>
          </div>

          {/* PAYMENT METHODS — always the icon grid, scaled smaller on mobile, never swapped for a text badge */}
          <div>
            <h3 className="text-[10px] sm:text-xs font-medium mb-1 sm:mb-2 md:mb-3 tracking-[0.05em] sm:tracking-[0.1em]">
              WE ACCEPT
            </h3>
            <div className="grid grid-cols-5 gap-0.5 sm:gap-1 md:gap-2">
              <div className="bg-white border border-gray-200 rounded p-0.5 sm:p-1 md:p-2 flex items-center justify-center shadow-sm h-4 sm:h-5 md:h-8">
                <svg viewBox="0 0 48 32" className="w-full h-full">
                  <rect width="48" height="32" fill="#1A1F71" />
                  <path d="M19.8 11.3L17 20.7H14.5L12.9 13.6C12.8 13.1 12.5 12.7 12 12.4C11.1 11.9 10 11.5 9 11.2L9.3 11.3H13.4C14 11.3 14.5 11.9 14.6 12.5L15.6 17.6L18.5 11.3H19.8ZM26.2 20.7H23.9L25.7 11.3H28L26.2 20.7ZM33.7 14.9C33.7 14.3 33.2 13.9 32.3 13.5C31.7 13.2 31.3 12.9 31.3 12.5C31.3 12.3 31.7 11.9 32.4 11.9C33 11.9 33.5 12.1 34 12.3L34.3 11.5C33.9 11.2 33.1 11.1 32.4 11.1C30.5 11.1 29.2 12.1 29.2 13.6C29.2 14.7 30.1 15.3 30.7 15.7C31.3 16.1 31.6 16.4 31.6 16.8C31.6 17.3 31 17.6 30.4 17.6C29.6 17.6 28.9 17.3 28.3 16.9L28 17.8C28.6 18.1 29.4 18.4 30.3 18.4C32.4 18.4 33.7 17.3 33.7 15.9V14.9ZM39.8 20.7H37.8L38.2 19.6H35.5L35 20.7H33.1L36.1 11.3H38L39.8 20.7ZM37 13.6L36.1 17.5H37.8L37 13.6Z" fill="white" />
                </svg>
              </div>
              <div className="bg-white border border-gray-200 rounded p-0.5 sm:p-1 md:p-2 flex items-center justify-center shadow-sm h-4 sm:h-5 md:h-8">
                <svg viewBox="0 0 48 32" className="w-full h-full">
                  <rect width="48" height="32" fill="white" />
                  <circle cx="18" cy="16" r="10" fill="#EB001B" />
                  <circle cx="30" cy="16" r="10" fill="#FF5F00" />
                  <path d="M24 8C26 10.4 27 13.1 27 16C27 18.9 26 21.6 24 24C22 21.6 21 18.9 21 16C21 13.1 22 10.4 24 8Z" fill="#FF5F00" />
                </svg>
              </div>
              <div className="bg-white border border-gray-200 rounded p-0.5 sm:p-1 md:p-2 flex items-center justify-center shadow-sm h-4 sm:h-5 md:h-8">
                <svg viewBox="0 0 48 32" className="w-full h-full">
                  <rect width="48" height="32" fill="#006FCF" />
                  <path d="M6.5 12.5H9L10 14.5L11 12.5H13.5L11.8 15.5L13.5 18.5H11L10 16.5L9 18.5H6.5L8.2 15.5L6.5 12.5Z" fill="white" />
                  <path d="M15 12.5H19.5V13.5H16V14.5H19V15.5H16V17.5H19.5V18.5H15V12.5Z" fill="white" />
                  <path d="M21 12.5H24.5C25.3 12.5 26 13.2 26 14V17C26 17.8 25.3 18.5 24.5 18.5H21V12.5ZM22 13.5V17.5H24.5C24.8 17.5 25 17.3 25 17V14C25 13.7 24.8 13.5 24.5 13.5H22Z" fill="white" />
                  <path d="M28 12.5H32.5V13.5H29V14.5H32V15.5H29V17.5H32.5V18.5H28V12.5Z" fill="white" />
                  <path d="M34 12.5H37.5L39 14.5L40.5 12.5H44L41.5 15.5L44 18.5H40.5L39 16.5L37.5 18.5H34L36.5 15.5L34 12.5Z" fill="white" />
                </svg>
              </div>
              <div className="bg-white border border-gray-200 rounded p-0.5 sm:p-1 md:p-2 flex items-center justify-center shadow-sm h-4 sm:h-5 md:h-8">
                <svg viewBox="0 0 48 32" className="w-full h-full">
                  <rect width="48" height="32" fill="white" />
                  <path d="M14 8H20C22.8 8 24.5 9.5 24.5 12.5C24.5 16 22.5 18 19.5 18H16.5L15.5 22H12.5L14 8ZM16.8 15.5H19C20.5 15.5 21.5 14.8 21.5 13.2C21.5 12.2 20.8 11.5 19.5 11.5H17.5L16.8 15.5Z" fill="#003087" />
                  <path d="M25 8H31C33.8 8 35.5 9.5 35.5 12.5C35.5 16 33.5 18 30.5 18H27.5L26.5 22H23.5L25 8ZM27.8 15.5H30C31.5 15.5 32.5 14.8 32.5 13.2C32.5 12.2 31.8 11.5 30.5 11.5H28.5L27.8 15.5Z" fill="#009CDE" />
                </svg>
              </div>
              <div className="bg-white border border-gray-200 rounded p-0.5 sm:p-1 md:p-2 flex items-center justify-center shadow-sm h-4 sm:h-5 md:h-8">
                <svg viewBox="0 0 48 32" className="w-full h-full">
                  <rect width="48" height="32" fill="black" />
                  <path d="M19.8 11.3C19.4 11.3 19 11.6 18.8 11.9C18.5 12.3 18.2 12.8 18.4 13.3C18.9 13.3 19.3 13.1 19.5 12.8C19.8 12.4 19.9 11.9 19.8 11.3ZM19.5 13.5C18.7 13.5 18.1 13.9 17.7 13.9C17.2 13.9 16.7 13.5 16.1 13.5C15.1 13.5 14.3 14.0 13.9 14.8C13.0 16.4 13.6 18.8 14.5 20.1C14.9 20.8 15.5 21.5 16.1 21.5C16.6 21.5 16.9 21.1 17.7 21.1C18.4 21.1 18.7 21.5 19.3 21.5C19.9 21.5 20.4 20.9 20.8 20.3C21.3 19.5 21.5 18.8 21.5 18.7C21.5 18.7 20.6 18.3 20.6 17.2C20.6 16.3 21.2 15.7 21.2 15.7C20.7 14.9 19.9 13.5 19.5 13.5Z" fill="white" />
                  <path d="M26.4 11.3V20.7H28.2V17.3H30.6C32.4 17.3 33.6 16.0 33.6 14.0S32.4 11.3 30.6 11.3H26.4V11.3ZM28.2 12.6H30.3C31.3 12.6 32.0 13.3 32.0 14.0S31.3 14.7 30.3 14.7H28.2V12.6Z" fill="white" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-1 sm:pt-2 md:pt-4">
          <p
            className="text-xs tracking-[0.05em] sm:tracking-[0.1em] md:tracking-[0.2em] font-light text-center"
            style={{ color: '#C44D2B', fontSize: '10px' }}
          >
            {settings.copyright || '© NOTORIOUS.Y2'}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default ShopFooter;