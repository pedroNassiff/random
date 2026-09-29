import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './components/Button'
import { NavTabs } from './components/NavTabs'
import { PlayerChip } from './components/PlayerChip'
import { SectionHeader } from './components/SectionHeader'
import { SkillPicker } from './components/SkillPicker'
import { Toast } from './components/Toast'
import { DevUiPage } from './pages/DevUiPage'

function picker(value: number | null) {
  const onChange = vi.fn()
  render(<SkillPicker label="Pase" description="Lectura del juego" value={value} onChange={onChange} />)
  return { onChange, slider: screen.getByRole('slider', { name: 'Pase' }) }
}

describe('SkillPicker', () => {
  it('expone role slider con valor y descripción', () => {
    const { slider } = picker(7)
    expect(slider).toHaveAttribute('aria-valuemin', '1')
    expect(slider).toHaveAttribute('aria-valuemax', '10')
    expect(slider).toHaveAttribute('aria-valuenow', '7')
    expect(slider).toHaveAttribute('aria-valuetext', '7 de 10')
    expect(screen.getByText('Lectura del juego')).toBeInTheDocument()
  })

  it('sin valor no declara aria-valuenow', () => {
    const { slider } = picker(null)
    expect(slider).not.toHaveAttribute('aria-valuenow')
    expect(slider).toHaveAttribute('aria-valuetext', 'Sin puntuar')
  })

  it('se maneja con flechas, Home y End, sin salirse de 1–10', async () => {
    const user = userEvent.setup()
    const { slider, onChange } = picker(10)
    slider.focus()
    await user.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith(10)
    await user.keyboard('{ArrowLeft}')
    expect(onChange).toHaveBeenLastCalledWith(9)
    await user.keyboard('{ArrowDown}')
    expect(onChange).toHaveBeenLastCalledWith(9)
    await user.keyboard('{Home}')
    expect(onChange).toHaveBeenLastCalledWith(1)
    await user.keyboard('{End}')
    expect(onChange).toHaveBeenLastCalledWith(10)
    await user.keyboard('a')
    expect(onChange).toHaveBeenCalledTimes(5)
  })

  it('desde vacío, la primera flecha arranca en 5 y el mínimo es 1', async () => {
    const user = userEvent.setup()
    const { slider, onChange } = picker(null)
    slider.focus()
    await user.keyboard('{ArrowUp}')
    expect(onChange).toHaveBeenLastCalledWith(5)
  })

  it('el mínimo no baja de 1', async () => {
    const user = userEvent.setup()
    const { slider, onChange } = picker(1)
    slider.focus()
    await user.keyboard('{ArrowLeft}')
    expect(onChange).toHaveBeenLastCalledWith(1)
  })

  it('click en una celda elige ese valor; click fuera de celdas no hace nada', async () => {
    const user = userEvent.setup()
    const { slider, onChange } = picker(3)
    const cell = slider.querySelector('[data-cell="8"]')
    if (!cell) throw new Error('no se encontró la celda 8')
    await user.click(cell)
    expect(onChange).toHaveBeenLastCalledWith(8)
    await user.click(slider)
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})

describe('componentes base', () => {
  it('Button: primario extruido, secundario, block y deshabilitado', () => {
    render(
      <>
        <Button>Voy</Button>
        <Button variant="secondary" block>
          Me bajo
        </Button>
        <Button disabled>Off</Button>
      </>,
    )
    expect(screen.getByRole('button', { name: 'Voy' })).toHaveClass('vf-extrude')
    expect(screen.getByRole('button', { name: 'Me bajo' })).toHaveClass('vf-btn--secondary', 'vf-btn--block')
    expect(screen.getByRole('button', { name: 'Off' })).toBeDisabled()
  })

  it('NavTabs marca la pestaña activa con aria-current', () => {
    render(
      <MemoryRouter initialEntries={['/b']}>
        <NavTabs
          tabs={[
            { to: '/a', label: 'A' },
            { to: '/b', label: 'B' },
          ]}
        />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'B' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'A' })).not.toHaveAttribute('aria-current')
  })

  it('PlayerChip: color de equipo, puesto en texto y rating solo si se pasa', () => {
    const { container } = render(
      <>
        <PlayerChip name="Juan" position="DEF" team="A" rating={27.14} />
        <PlayerChip name="Fede" team="B" />
        <PlayerChip name="Sin equipo" />
      </>,
    )
    const chips = container.querySelectorAll('.vf-chip')
    expect(chips[0]).toHaveClass('vf-chip--a')
    expect(chips[1]).toHaveClass('vf-chip--b')
    expect(chips[2]).not.toHaveClass('vf-chip--a', 'vf-chip--b')
    expect(screen.getByText('· DEF')).toBeInTheDocument()
    expect(screen.getByText('27.1')).toBeInTheDocument()
    expect(screen.queryAllByText(/^\d+\.\d$/)).toHaveLength(1)
  })

  it('SectionHeader renderiza un h2', () => {
    render(<SectionHeader>Convocados</SectionHeader>)
    expect(screen.getByRole('heading', { level: 2, name: 'Convocados' })).toBeInTheDocument()
  })

  it('Toast aparece con role status y se cierra solo', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    const { rerender } = render(<Toast message="Guardado" onDone={onDone} ms={1000} />)
    expect(screen.getByRole('status')).toHaveTextContent('Guardado')
    act(() => vi.advanceTimersByTime(1000))
    expect(onDone).toHaveBeenCalledTimes(1)
    rerender(<Toast message={null} onDone={onDone} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('DevUiPage muestra todos los componentes base', () => {
    render(
      <MemoryRouter>
        <DevUiPage />
      </MemoryRouter>,
    )
    for (const name of ['Button', 'NavTabs', 'PlayerChip', 'SkillPicker', 'Toast']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    }
  })
})
