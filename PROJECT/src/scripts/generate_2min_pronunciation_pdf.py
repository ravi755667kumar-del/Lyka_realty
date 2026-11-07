import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_pdf():
    output_dir = 'datasets'
    os.makedirs(output_dir, exist_ok=True)
    pdf_path = os.path.join(output_dir, 'Lyka_Realty_2_Minute_Dynamic_Pronunciation_Voice_Guide.pdf')
    
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    
    # Custom Palette
    primary_color = colors.HexColor('#1E293B')   # Deep Slate
    accent_color = colors.HexColor('#0284C7')    # Sky Blue
    gold_color = colors.HexColor('#D97706')      # Amber/Gold
    light_bg = colors.HexColor('#F8FAFC')        # Soft Slate
    border_color = colors.HexColor('#CBD5E1')

    # Typography styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=primary_color,
        spaceAfter=6
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=gold_color,
        spaceAfter=14
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=accent_color,
        spaceBefore=12,
        spaceAfter=6
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Heading3'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=primary_color,
        spaceBefore=8,
        spaceAfter=4
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155'),
        spaceAfter=6
    )

    code_style = ParagraphStyle(
        'Code_Custom',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#0F172A')
    )

    story = []

    # Header / Title
    story.append(Paragraph("LYKA REALTY — AI CALL CENTER SPECIFICATION", subtitle_style))
    story.append(Paragraph("2-Minute Dynamic Pronunciation & Voice Modulation Guide (v9)", title_style))
    story.append(Paragraph("Operational Guidelines for Natural Indian Voice Agents (Tanglish, English & Hindi)", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=accent_color, spaceBefore=4, spaceAfter=12))

    # Executive Overview
    story.append(Paragraph("1. Executive Objective: The 2-Minute Natural Voice Rule", h1_style))
    story.append(Paragraph(
        "A live telecalling conversation typically lasts between 90 and 120 seconds (strictly under 2 minutes). "
        "During this window, a human agent dynamically modulates their tone, avoids robotic repetition of the same words, "
        "and uses natural pronunciation variations depending on context. The AI virtual caller (Priya / Karthik) must "
        "reproduce this natural human behavior across all 4 quarters of a 2-minute call, alternating pronunciations "
        "and acoustic delivery tags rather than repeating static scripted phrases.",
        body_style
    ))

    # Timeline Breakdown Table
    story.append(Paragraph("2. 2-Minute Call Progression & Dynamic Pronunciation Timeline", h1_style))
    
    timeline_data = [
        [
            Paragraph("<b>Timeline</b>", h2_style),
            Paragraph("<b>Phase & Intent</b>", h2_style),
            Paragraph("<b>Target Pronunciations & Modulation</b>", h2_style),
            Paragraph("<b>Sample Spoken Turn (Max 20 words)</b>", h2_style)
        ],
        [
            Paragraph("<b>0:00 – 0:30</b><br/>Quarter 1", body_style),
            Paragraph("<b>Warm Opening & Consent</b><br/>Acknowledge enquiry, ask consent for 2-minute call.", body_style),
            Paragraph("Upbeat, bright, welcoming.<br/>• <i>Vanakkam sir</i><br/>• <i>Ippo oru 2 minutes pesalaama?</i>", body_style),
            Paragraph("<i>'[warm] Vanakkam sir! Naan Priya, Lyka Realty-la irundhu pesaren. Oru 2 minutes pesalaama?'</i>", code_style)
        ],
        [
            Paragraph("<b>0:30 – 1:00</b><br/>Quarter 2", body_style),
            Paragraph("<b>Needs Discovery</b><br/>Identify purpose, BHK, location preference.", body_style),
            Paragraph("Inquiring, gentle, curious.<br/>• <i>B-H-K</i> (letter-by-letter)<br/>• <i>apartment / flat</i>", body_style),
            Paragraph("<i>'[friendly] Sandhosham Arun! Neenga own use-kkaaga paakureengala, illa investment-aa?'</i>", code_style)
        ],
        [
            Paragraph("<b>1:00 – 1:30</b><br/>Quarter 3", body_style),
            Paragraph("<b>Value Presentation</b><br/>Quote single best verified highlight.", body_style),
            Paragraph("Confident, articulate, crisp.<br/>• <i>72 lakh rupees</i><br/>• <i>C-M-D-A / D-T-C-P approved</i>", body_style),
            Paragraph("<i>'[thinking] Ah, Velachery-la ready-to-move 2 B-H-K flat irukku, 72 lakhs. Near MRT station.'</i>", code_style)
        ],
        [
            Paragraph("<b>1:30 – 2:00</b><br/>Quarter 4", body_style),
            Paragraph("<b>Polite Wrap-up & Next Step</b><br/>Confirm WhatsApp share or site visit.", body_style),
            Paragraph("Warm decelerando, appreciative.<br/>• <i>Romba nandri</i><br/>• <i>WhatsApp-la anupuren</i>", body_style),
            Paragraph("<i>'[warm] Romba nandri Arun! Details WhatsApp-la share panren. Neenga free-a irukkumbodhu check pannunga.'</i>", code_style)
        ]
    ]

    t_timeline = Table(timeline_data, colWidths=[65, 120, 150, 205])
    t_timeline.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), light_bg),
        ('BOX', (0, 0), (-1, -1), 0.5, border_color),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, border_color),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(t_timeline)
    story.append(Spacer(1, 10))

    # Page Break for Pronunciation Dictionary
    story.append(PageBreak())

    # Master Pronunciation Variation Dictionary
    story.append(Paragraph("3. Master Pronunciation Variation Dictionary for Telecallers", h1_style))
    story.append(Paragraph(
        "To prevent repetitive TTS monotony over 2 minutes, the AI speech layer and LLM must alternate between "
        "phonetic variations across turns. Below are verified pronunciation mappings:",
        body_style
    ))

    pronounce_data = [
        [
            Paragraph("<b>Category</b>", h2_style),
            Paragraph("<b>Written Text</b>", h2_style),
            Paragraph("<b>Primary Spoken Pronunciation</b>", h2_style),
            Paragraph("<b>Turn-by-Turn Dynamic Variation</b>", h2_style)
        ],
        [
            Paragraph("Call Duration", body_style),
            Paragraph("2 min / 2 mins / 2m", code_style),
            Paragraph("<b>two minutes</b> (clear breath)", body_style),
            Paragraph("Cycle: <i>'two minutes'</i> &rarr; <i>'quick 2 minutes'</i> &rarr; <i>'oru nimisham'</i>", body_style)
        ],
        [
            Paragraph("Configuration", body_style),
            Paragraph("2BHK / 3BHK", code_style),
            Paragraph("<b>two B-H-K</b> (spaced syllables)", body_style),
            Paragraph("Cycle: <i>'2 B-H-K'</i> &rarr; <i>'two-bedroom flat'</i> &rarr; <i>'apartment'</i>", body_style)
        ],
        [
            Paragraph("Price & Currency", body_style),
            Paragraph("Rs. 72L / 72 Lakhs", code_style),
            Paragraph("<b>72 lakh rupees</b>", body_style),
            Paragraph("Cycle: <i>'72 lakhs'</i> &rarr; <i>'seventy-two lakh rupees'</i> &rarr; <i>'72 L'</i>", body_style)
        ],
        [
            Paragraph("Size & Area", body_style),
            Paragraph("950 sq ft / sqft", code_style),
            Paragraph("<b>950 square feet</b>", body_style),
            Paragraph("Cycle: <i>'950 square feet'</i> &rarr; <i>'nine-fifty sq ft'</i>", body_style)
        ],
        [
            Paragraph("Regulators", body_style),
            Paragraph("CMDA / DTCP", code_style),
            Paragraph("<b>C-M-D-A / D-T-C-P</b> (never acronym sound)", body_style),
            Paragraph("Always spell out: <i>'C-M-D-A approved'</i> (avoid 'cumda')", body_style)
        ],
        [
            Paragraph("Tamil Colloquial", body_style),
            Paragraph("-lendhu / pesuren", code_style),
            Paragraph("<b>-la irundhu / pesaren</b> (polite)", body_style),
            Paragraph("Alternate: <i>'pesaren'</i> &rarr; <i>'pesalaama'</i> &rarr; <i>'kekkudhaa'</i>", body_style)
        ],
        [
            Paragraph("Active Listening", body_style),
            Paragraph("Aan / Haan / Yes", code_style),
            Paragraph("<b>Aan... / Haan ji... / Got it...</b>", body_style),
            Paragraph("Vary backchannel: <i>'Aan, puriyudhu!'</i> &rarr; <i>'Kandippa!'</i> &rarr; <i>'Ah, got it!'</i>", body_style)
        ]
    ]

    t_pronounce = Table(pronounce_data, colWidths=[90, 110, 150, 190])
    t_pronounce.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), light_bg),
        ('BOX', (0, 0), (-1, -1), 0.5, border_color),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, border_color),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(t_pronounce)
    story.append(Spacer(1, 10))

    # Anti-Monotony Enforcement
    story.append(Paragraph("4. Anti-Monotony & Repetition Rules for 2-Minute Calls", h1_style))
    story.append(Paragraph(
        "1. <b>Never repeat identical opening phrases:</b> If the customer answers 'Hello', alternate between 'Vanakkam sir', 'Good morning Arun', or 'Aan, vanakkam!'.<br/>"
        "2. <b>Dynamic Word Pacing:</b> Strict limit of 15 to 25 words per turn. Fast, conversational replies prevent dead air.<br/>"
        "3. <b>Customer Interruption Immediate Yield:</b> If the customer speaks while AI speaks, AI stops within 100ms and immediately addresses what the customer asked.<br/>"
        "4. <b>Wrap-up Compliance:</b> When the 2-minute mark approaches, gracefully transition to sending details over WhatsApp or booking a 10-minute site visit.",
        body_style
    ))

    doc.build(story)
    print(f"PDF Successfully generated at: {pdf_path}")

if __name__ == '__main__':
    generate_pdf()
