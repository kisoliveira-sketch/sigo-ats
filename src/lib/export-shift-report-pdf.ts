import jsPDF from "jspdf";

type ShiftDetail = {
  shift_code: string;
  operational_date: string;
  start_time_utc: string | null;
  end_time_utc: string | null;
  status: string;
  opening_notes: string | null;
  handover_notes: string | null;
};

type EntryRow = {
  occurrence_number: string;
  severity: string;
  occurrence_at_utc: string;
  description_factual: string;
  involved_entities: string | null;
  actions_taken: string | null;
  outcome: string | null;
  communications_made: string | null;
  documentary_reference: string | null;
  callsign: string | null;
  aircraft_registration: string | null;
  aircraft_type: string | null;
  equipment_reference: string | null;
  location_detail: string | null;
  weather_context: string | null;
  requires_followup: boolean;
  occurrence_categories: {
    name: string;
    code: string;
  } | null;
};

type ExportArgs = {
  shift: ShiftDetail;
  entries: EntryRow[];
  supervisor: string;
  composition: string;
  notes: string;
  weatherSummary: string;
  equipmentSummary: string;
  occurrenceLevelSummary: string;
  pendingFollowupCount: number;
};

function safe(value: string | null | undefined) {
  return value?.trim() || "—";
}

function formatUtcDateTime(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
}

export function exportShiftReportPdf({
  shift,
  entries,
  supervisor,
  composition,
  notes,
  weatherSummary,
  equipmentSummary,
  occurrenceLevelSummary,
  pendingFollowupCount,
}: ExportArgs) {
  const doc = new jsPDF({
    orientation: "p",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const left = 15;
  const right = 15;
  const top = 15;
  const bottom = 15;
  const width = pageWidth - left - right;

  let y = top;

  const ensureSpace = (needed = 6) => {
    if (y + needed > pageHeight - bottom) {
      doc.addPage();
      y = top;
      drawHeader(false);
    }
  };

  const drawHeader = (firstPage = false) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(firstPage ? 14 : 10);
    doc.text("RELATÓRIO ATS", left, y);

    if (firstPage) {
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Registo operacional consolidado do turno", left, y);
      y += 5;
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(safe(shift.shift_code), pageWidth - right, y, {
        align: "right",
      });
      y += 4;
    }

    doc.setDrawColor(120);
    doc.setLineWidth(0.2);
    doc.line(left, y, pageWidth - right, y);
    y += 5;
  };

  const addSectionTitle = (title: string) => {
    ensureSpace(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(title, left, y);
    y += 4;
  };

  const addParagraph = (text: string, fontSize = 9, indent = 0) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(safe(text), width - indent) as string[];
    const blockHeight = lines.length * 4.2;
    ensureSpace(blockHeight + 2);
    doc.text(lines, left + indent, y);
    y += blockHeight + 1.5;
  };

  const addField = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const labelText = `${label}: `;
    const labelWidth = doc.getTextWidth(labelText);

    doc.text(labelText, left, y);

    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(
      safe(value),
      width - labelWidth - 2,
    ) as string[];
    const blockHeight = Math.max(4.2, lines.length * 4.2);
    ensureSpace(blockHeight + 1);
    doc.text(lines, left + labelWidth + 1, y);
    y += blockHeight;
  };

  const addBlank = (space = 2) => {
    y += space;
  };

  const addRule = () => {
    ensureSpace(3);
    doc.setDrawColor(180);
    doc.setLineWidth(0.15);
    doc.line(left, y, pageWidth - right, y);
    y += 3;
  };

  drawHeader(true);

  addSectionTitle("1. IDENTIFICAÇÃO DO TURNO");
  addField("Referência do turno", shift.shift_code);
  addField("Data operacional", shift.operational_date);
  addField("Estado", shift.status);
  addField("Supervisor", supervisor);
  addField("Início UTC", formatUtcDateTime(shift.start_time_utc));
  addField("Fim UTC", formatUtcDateTime(shift.end_time_utc));
  addField("Número de entradas", String(entries.length));
  addField("Nível mais elevado de ocorrência", occurrenceLevelSummary);
  addField("Entradas com follow-up", String(pendingFollowupCount));
  addBlank();

  addSectionTitle("2. COMPOSIÇÃO DO TURNO");
  addParagraph(composition);
  addBlank();

  addSectionTitle("3. CONDIÇÕES METEOROLÓGICAS REPORTADAS");
  addParagraph(weatherSummary);
  addBlank();

  addSectionTitle("4. CONDIÇÕES / REFERÊNCIAS DE EQUIPAMENTOS");
  addParagraph(equipmentSummary);
  addBlank();

  addSectionTitle("5. NOTAS DE ABERTURA");
  addParagraph(notes);
  addBlank();

  addSectionTitle("6. NOTAS DE FECHO");
  addParagraph(shift.handover_notes || "—");
  addBlank();

  addSectionTitle("7. RESUMO DAS ENTRADAS ATS");
  entries.forEach((entry, index) => {
    ensureSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(
      `${index + 1}. ${safe(entry.occurrence_number)} | ${formatUtcDateTime(entry.occurrence_at_utc)} | ${safe(entry.occurrence_categories?.name)} | ${safe(entry.severity)} | Follow-up: ${entry.requires_followup ? "Sim" : "Não"}`,
      left,
      y,
    );
    y += 4.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.8);
    const summary = doc.splitTextToSize(
      safe(entry.description_factual),
      width,
    ) as string[];
    ensureSpace(summary.length * 4 + 2);
    doc.text(summary, left, y);
    y += summary.length * 4 + 1.5;

    if (index < entries.length - 1) addRule();
  });

  addBlank(2);
  addSectionTitle("8. DESCRIÇÃO DETALHADA DAS ENTRADAS");

  entries.forEach((entry, index) => {
    ensureSpace(14);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(`${index + 1}. ${safe(entry.occurrence_number)}`, left, y);
    y += 5;

    addField("Data/Hora UTC", formatUtcDateTime(entry.occurrence_at_utc));
    addField("Categoria", safe(entry.occurrence_categories?.name));
    addField("Gravidade", safe(entry.severity));
    addField("Follow-up", entry.requires_followup ? "Sim" : "Não");
    addField("Callsign", safe(entry.callsign));
    addField("Matrícula", safe(entry.aircraft_registration));
    addField("Tipo de aeronave", safe(entry.aircraft_type));
    addField("Local / detalhe", safe(entry.location_detail));
    addField("Equipamento", safe(entry.equipment_reference));
    addField("Meteorologia", safe(entry.weather_context));
    addField("Descrição factual", safe(entry.description_factual));
    addField("Envolvidos", safe(entry.involved_entities));
    addField("Ações tomadas", safe(entry.actions_taken));
    addField("Resultado / consequência", safe(entry.outcome));
    addField("Comunicações efetuadas", safe(entry.communications_made));
    addField("Referência documental", safe(entry.documentary_reference));

    addBlank(2);
    if (index < entries.length - 1) addRule();
  });

  addBlank(4);
  ensureSpace(20);

  addSectionTitle("9. VALIDAÇÃO");
  y += 8;
  doc.line(left, y, 90, y);
  doc.line(115, y, pageWidth - right, y);

  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Supervisor / responsável", left, y);
  doc.text("Data", 115, y);

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(
      `${safe(shift.shift_code)}  |  Página ${i} de ${pageCount}`,
      pageWidth - right,
      pageHeight - 6,
      { align: "right" },
    );
  }

  doc.save(`${shift.shift_code}.pdf`);
}
