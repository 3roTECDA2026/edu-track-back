import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { attachmentDisposition } from './contentDisposition'

describe('Content-Disposition de las descargas (CRM-060)', () => {
  it('manda el nombre en UTF-8 y una versión ASCII sin tildes de respaldo', () => {
    assert.equal(
      attachmentDisposition('evaluación ñandú.pdf'),
      `attachment; filename="evaluacion nandu.pdf"; filename*=UTF-8''evaluaci%C3%B3n%20%C3%B1and%C3%BA.pdf`
    )
  })

  it('reemplaza comillas, barras y saltos de línea, que romperían el encabezado', () => {
    const header = attachmentDisposition('a"b\\c/d;e\r\nf.pdf')
    assert.match(header, /^attachment; filename="a_b_c_d_e__f\.pdf";/)
    assert.equal(header.includes('\n'), false)
  })

  it("codifica ' ( ) * en filename*", () => {
    assert.match(
      attachmentDisposition("TP (1)'*.pdf"),
      /filename\*=UTF-8''TP%20%281%29%27%2A\.pdf$/
    )
  })
})
