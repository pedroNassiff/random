import type { ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
  block?: boolean
}

export function Button({ variant = 'primary', block, className = '', type = 'button', ...rest }: Props) {
  const cls = [
    'vf-btn',
    variant === 'primary' ? 'vf-extrude' : 'vf-btn--secondary',
    block ? 'vf-btn--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return <button type={type} className={cls} {...rest} />
}
