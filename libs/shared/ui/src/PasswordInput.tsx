'use client';

import React, { useState } from 'react';
import { OndaIcons } from './icons';

export type PasswordInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
>;

/** Input de contraseña con toggle mostrar/ocultar (íconos eye / eyeOff). */
export function PasswordInput({
  className = '',
  ...rest
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="onda-password-input">
      <input
        {...rest}
        type={visible ? 'text' : 'password'}
        className={`onda-input onda-password-input__field ${className}`.trim()}
      />
      <button
        type="button"
        className="onda-password-input__toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
      >
        {visible ? OndaIcons.eyeOff : OndaIcons.eye}
      </button>
    </div>
  );
}
