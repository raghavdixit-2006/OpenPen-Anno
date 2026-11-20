/**
 * The frozen screenshot layer. It lives between the backdrop and the ink, so
 * annotations still draw on top of the paused frame exactly like they do on
 * the live screen.
 *
 * The source image is captured at native display resolution; the canvas is
 * sized like every other overlay layer (CSS pixels x DPR), so the screenshot
 * is stretched to the window and then zoomed along with the ink by the shared
 * viewport transform.
 */
export class FreezeRenderer {
  private readonly ctx: CanvasRenderingContext2D
  private width = 1
  private height = 1

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas is not available')
    this.ctx = ctx
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.width = Math.max(1, cssWidth)
    this.height = Math.max(1, cssHeight)

    this.canvas.width = Math.round(this.width * dpr)
    this.canvas.height = Math.round(this.height * dpr)
    this.canvas.style.width = `${this.width}px`
    this.canvas.style.height = `${this.height}px`
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  draw(image: CanvasImageSource): void {
    this.clear()
    this.ctx.drawImage(image, 0, 0, this.width, this.height)
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.width, this.height)
  }
}
