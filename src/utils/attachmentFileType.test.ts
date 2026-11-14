import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { detectAttachmentType } from '@/utils/attachmentFileType'

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00])
const PDF = new TextEncoder().encode('%PDF-1.7 ...')
const DOCX = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00])

describe('detectAttachmentType', () => {
  it('acepta los cuatro tipos permitidos', () => {
    assert.equal(detectAttachmentType('foto.png', PNG)?.mimeType, 'image/png')
    assert.equal(detectAttachmentType('foto.jpg', JPG)?.mimeType, 'image/jpeg')
    assert.equal(detectAttachmentType('foto.jpeg', JPG)?.mimeType, 'image/jpeg')
    assert.equal(detectAttachmentType('acta.pdf', PDF)?.mimeType, 'application/pdf')
    assert.ok(detectAttachmentType('informe.docx', DOCX))
  })

  it('no distingue mayúsculas en la extensión', () => {
    assert.deepEqual(detectAttachmentType('FOTO.PNG', PNG), {
      mimeType: 'image/png',
      extension: '.png',
    })
  })

  it('rechaza extensiones no permitidas', () => {
    assert.equal(detectAttachmentType('script.exe', PNG), null)
    assert.equal(detectAttachmentType('sin-extension', PDF), null)
    assert.equal(detectAttachmentType('planilla.xlsx', DOCX), null)
  })

  it('rechaza archivos cuyo contenido no coincide con la extensión', () => {
    assert.equal(detectAttachmentType('falso.pdf', PNG), null)
    assert.equal(detectAttachmentType('falso.png', new TextEncoder().encode('hola')), null)
  })

  it('rechaza archivos vacíos', () => {
    assert.equal(detectAttachmentType('vacio.pdf', new Uint8Array()), null)
  })
})
