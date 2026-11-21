/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';

/**
 * Hook to provide smooth entrance AND exit animations for Popups & Modals
 */
export function useModalAnimation(isOpen: boolean, duration: number = 220) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
    } else if (shouldRender) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, shouldRender]);

  return {
    shouldRender,
    isClosing,
    backdropAnimationClass: isClosing ? 'modal-backdrop-animate-out' : 'modal-backdrop-animate',
    modalAnimationClass: isClosing ? 'modal-pop-out' : 'modal-pop-in',
  };
}

/**
 * Hook to provide smooth entrance AND exit animations for Dropdown Menus & Popovers
 */
export function useDropdownAnimation(isOpen: boolean, duration: number = 180) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
    } else if (shouldRender) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, shouldRender]);

  return {
    shouldRender,
    isClosing,
    dropdownAnimationClass: isClosing ? 'dropdown-animate-out' : 'dropdown-animate-in',
  };
}
