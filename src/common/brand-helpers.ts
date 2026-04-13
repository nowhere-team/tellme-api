// generic branded converter
type BrandFn<T> = (id: string) => T

function _optionalBrand<T>(id: string | undefined, fn: BrandFn<T>): T | undefined {
	return id !== undefined ? fn(id) : undefined
}
