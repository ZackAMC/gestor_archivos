// Guarda solo los N elementos "más grandes" según un criterio.
// Con millones de archivos, NO podemos guardarlos todos para ordenarlos al final.

export class TopList<T> {
  private items: T[] = []

  constructor(
    private readonly limit: number,
    private readonly score: (item: T) => number,
  ) {}

  add(item: T): void {
    this.items.push(item)
    // Ordenamos recién cuando nos pasamos del doble: menos trabajo que ordenar en cada add.
    if (this.items.length >= this.limit * 2) this.trim()
  }

  values(): T[] {
    this.trim()
    return [...this.items]
  }

  private trim(): void {
    this.items.sort((a, b) => this.score(b) - this.score(a))
    this.items.length = Math.min(this.items.length, this.limit)
  }
}
