"""Gera PDF sintético com fonte incorporada em subconjunto (ReportLab, somente desenvolvimento)."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
root = Path(__file__).resolve().parents[4]
font = root / 'public/standard_fonts/LiberationSans-Regular.ttf'
pdfmetrics.registerFont(TTFont('LiberationFixture', str(font)))
output = Path(__file__).with_name('embedded-subset.pdf')
pdf = canvas.Canvas(str(output), pagesize=(500, 700), invariant=1)
pdf.setFont('LiberationFixture', 18)
pdf.drawString(70, 500, 'Texto original com ação')
pdf.setFont('LiberationFixture', 14)
pdf.drawString(70, 400, 'Conteúdo preservado')
pdf.save()
