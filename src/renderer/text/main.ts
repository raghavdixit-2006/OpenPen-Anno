import './text.css'
import { textFontSize } from '../../engine'

const card = document.getElementById('card')
const input = document.getElementById('input') as HTMLTextAreaElement | null
const add = document.getElementById('add') as HTMLButtonElement | null

if (!card || !input || !add) throw new Error('Text popup markup is incomplete')

function submit(): void {
  const text = input!.value.trim()
  if (text.length === 0) {
    input!.focus()
    return
  }
  window.api.text.commit(text)
}

input.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault()
    window.api.text.cancel()
    return
  }
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    submit()
  }
})

add.addEventListener('click', submit)

// Main owns the colour and brush size; the popup only mirrors them so the
// committed annotation matches what the user saw while typing.
void window.api.text.getContext().then((context) => {
  if (!context) return
  const fontSize = textFontSize(context.size)
  card.style.setProperty('--ink', context.color)
  input.style.color = context.color
  input.style.fontSize = `${fontSize}px`
  input.style.caretColor = context.color
  input.maxLength = context.maxLength
  input.focus()
})
