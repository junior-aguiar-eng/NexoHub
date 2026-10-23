"""Regenera fixtures sintéticas. Uso opcional: Python + pypdf 6.10.0 + PyMuPDF 1.26.6.

Os testes JS usam os PDFs versionados; nenhuma dependência Python em produção.
Senhas sintéticas públicas: usuário = " senha com espacos "; proprietário = "dono".
"""
from pathlib import Path
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, NameObject, DictionaryObject, ArrayObject, TextStringObject, FloatObject, NumberObject
out=Path(__file__).resolve().parent
for algorithm in ['RC4-40','RC4-128','AES-128','AES-256-R5','AES-256','permissions-only']:
 w=PdfWriter(); p=w.add_blank_page(width=300,height=400)
 font=w._add_object(DictionaryObject({NameObject('/Type'):NameObject('/Font'),NameObject('/Subtype'):NameObject('/Type1'),NameObject('/BaseFont'):NameObject('/Helvetica')}))
 p[NameObject('/Resources')]=DictionaryObject({NameObject('/Font'):DictionaryObject({NameObject('/F1'):font})})
 s=DecodedStreamObject(); s.set_data(b'BT /F1 12 Tf 10 300 Td (NexoHub unlocked text) Tj ET'); p[NameObject('/Contents')]=w._add_object(s.flate_encode())
 w.add_metadata({'/Title':'Titulo preservado','/Author':'Auditoria NexoHub'}); w.add_outline_item('Marcador',0)
 link=DictionaryObject({NameObject('/Type'):NameObject('/Annot'),NameObject('/Subtype'):NameObject('/Link'),NameObject('/Rect'):ArrayObject([FloatObject(x) for x in (10,290,180,315)]),NameObject('/A'):DictionaryObject({NameObject('/S'):NameObject('/URI'),NameObject('/URI'):TextStringObject('https://example.com/documento')})})
 field=DictionaryObject({NameObject('/Type'):NameObject('/Annot'),NameObject('/Subtype'):NameObject('/Widget'),NameObject('/FT'):NameObject('/Tx'),NameObject('/T'):TextStringObject('nome'),NameObject('/V'):TextStringObject('Valor editavel'),NameObject('/Rect'):ArrayObject([FloatObject(x) for x in (10,220,160,240)]),NameObject('/P'):p.indirect_reference})
 fr=w._add_object(field); p[NameObject('/Annots')]=ArrayObject([w._add_object(link),fr]); w._root_object[NameObject('/AcroForm')]=w._add_object(DictionaryObject({NameObject('/Fields'):ArrayObject([fr]),NameObject('/NeedAppearances'):NumberObject(1)}))
 w.add_attachment('anexo.txt',b'Anexo preservado')
 metadata=DecodedStreamObject();metadata.set_data(b'<?xpacket begin=""?><x:xmpmeta xmlns:x="adobe:ns:meta/">XMP preservado</x:xmpmeta><?xpacket end="w"?>');metadata[NameObject('/Type')]=NameObject('/Metadata');metadata[NameObject('/Subtype')]=NameObject('/XML');w._root_object[NameObject('/Metadata')]=w._add_object(metadata)
 if algorithm=='permissions-only': w.encrypt('', 'dono',algorithm='AES-128',permissions_flag=4)
 else:w.encrypt(' senha com espacos ','dono',algorithm=algorithm)
 w.write(out/(algorithm+'.pdf'))
import fitz
source=out/'AES-256.pdf'
doc=fitz.open(source); assert doc.authenticate(' senha com espacos ')
doc.save(out/'AES-256-object-streams.pdf', encryption=fitz.PDF_ENCRYPT_AES_256,owner_pw='dono',user_pw=' senha com espacos ',use_objstms=1,deflate=True)
from pypdf import PdfReader
import shutil
shutil.copyfile(source,out/'AES-256-incremental.pdf')
doc=fitz.open(out/'AES-256-incremental.pdf');doc.authenticate(' senha com espacos ');info=doc.metadata;info['subject']='Atualizacao incremental';doc.set_metadata(info);doc.saveIncr();doc.close()
from pypdf.generic import BooleanObject, ByteStringObject
reader=PdfReader(source);reader.decrypt(' senha com espacos ')
w=PdfWriter(clone_from=reader);w.encrypt(' senha com espacos ','dono',algorithm='AES-128');w._encryption.EncryptMetadata=False
entry=w._encryption.write_entry(' senha com espacos ','dono');entry[NameObject('/EncryptMetadata')]=BooleanObject(False);entry.indirect_reference=w._encrypt_entry.indirect_reference;w._objects[entry.indirect_reference.idnum-1]=entry;w._encrypt_entry=entry
# pypdf's serializer encrypts all streams; override only metadata, as required by PDF spec.
orig_encrypt=w._encryption.encrypt_object
def encrypt_except_metadata(obj,idnum,generation):
 if isinstance(obj,DecodedStreamObject) and obj.get('/Type')=='/Metadata':return obj
 return orig_encrypt(obj,idnum,generation)
w._encryption.encrypt_object=encrypt_except_metadata
w.write(out/'AES-128-plain-metadata.pdf')
reader=PdfReader(source);reader.decrypt(' senha com espacos ')
w=PdfWriter(clone_from=reader);w._header=b'%PDF-2.0';w.encrypt(' senha com espacos ','dono',algorithm='AES-256');w.write(out/'AES-256-pdf2.pdf')
reader=PdfReader(source);reader.decrypt(' senha com espacos ')
w=PdfWriter(clone_from=reader);w._add_object(DictionaryObject({NameObject('/Type'):NameObject('/Sig'),NameObject('/ByteRange'):ArrayObject([NumberObject(0),NumberObject(1),NumberObject(2),NumberObject(3)]),NameObject('/Contents'):ByteStringObject(b'placeholder')}));w.encrypt(' senha com espacos ','dono',algorithm='AES-128');w.write(out/'signed-placeholder.pdf')
