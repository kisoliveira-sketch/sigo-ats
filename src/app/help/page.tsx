"use client";

import Link from "next/link";
import {
  AlertIcon,
  ClockIcon,
  EditIcon,
  FileIcon,
  heroActionClass,
  InfoIcon,
  LoginIcon,
  LogoutIcon,
  PageShell,
  SectionCard,
  SoftIcon,
  UsersIcon,
} from "@/components/siro-ui";

function HelpItem({
  step,
  title,
  text,
}: {
  step: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-[0.9rem] border border-slate-200 bg-slate-50/70 px-4 py-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#1d4f91] px-2 text-[11px] font-semibold text-white">
          {step}
        </span>
        <div>
          <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
        </div>
      </div>
    </div>
  );
}

export default function HelpPage() {
  return (
    <PageShell
      badge="Ajuda"
      title="Manual de utilização"
      subtitle="Guia rápido de uso do SIGO-ATS com base no fluxo operacional atual."
      heroIcon={<InfoIcon />}
      compact
      heroThin
      actions={
        <>
          <Link href="/" className={heroActionClass("primary")}>
            Painel principal
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        <SectionCard
          icon={
            <SoftIcon tone="blue">
              <InfoIcon />
            </SoftIcon>
          }
          title="Visão geral"
          subtitle="O SIGO-ATS apoia a gestão do turno, dos logs de posição operacional e do registo de ocorrências ATS."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <HelpItem
              step="1"
              title="Entrar no sistema"
              text='Use o seu email institucional. No primeiro acesso, se necessário, utilize "Esqueceu-se da palavra-passe?" para definir a credencial.'
            />
            <HelpItem
              step="2"
              title="Abrir turno"
              text="O turno deve ser aberto no início da operação. Nesta etapa é fixada a composição da equipa."
            />
            <HelpItem
              step="3"
              title="Seguir o fluxo"
              text="Depois do turno aberto, seguem-se os logs de posição, o registo ATS, a validação e o encerramento."
            />
          </div>
        </SectionCard>

        <SectionCard
          icon={
            <SoftIcon tone="orange">
              <LoginIcon />
            </SoftIcon>
          }
          title="Abertura do turno"
          subtitle="A abertura do turno inicia o ciclo operacional do registo."
        >
          <div className="space-y-3">
            <HelpItem
              step="1"
              title="Selecionar o horário"
              text="Escolha o turno correspondente ao órgão ATS e ao período operacional em curso."
            />
            <HelpItem
              step="2"
              title="Definir a composição"
              text="Indique os CTA que integram o turno e a função de cada elemento, incluindo supervisor, CTA operacional, OJT ou OJTI."
            />
            <HelpItem
              step="3"
              title="Confirmar a abertura"
              text="Depois de aberto, o turno passa a ficar visível no painel principal e desbloqueia o restante fluxo operacional."
            />
          </div>
        </SectionCard>

        <SectionCard
          icon={
            <SoftIcon tone="blue">
              <UsersIcon />
            </SoftIcon>
          }
          title="Logs operacionais"
          subtitle="Os logs registam quem entra e sai da posição operacional."
        >
          <div className="space-y-3">
            <HelpItem
              step="1"
              title="Registar entrada"
              text="Com turno aberto, o supervisor regista a entrada do CTA na posição operacional. A nota pode identificar a posição ou setor."
            />
            <HelpItem
              step="2"
              title="Registar saída"
              text="Quando o CTA deixa a posição, a saída deve ser registada antes do encerramento do turno."
            />
            <HelpItem
              step="3"
              title="Regra importante"
              text="Enquanto existirem posições operacionais ativas, o registo ATS não deve ser validado e o turno não pode ser encerrado."
            />
          </div>
        </SectionCard>

        <SectionCard
          icon={
            <SoftIcon tone="blue">
              <FileIcon />
            </SoftIcon>
          }
          title="Registo ATS"
          subtitle="O registo ATS concentra as ocorrências lançadas no turno."
        >
          <div className="space-y-3">
            <HelpItem
              step="1"
              title="Nova entrada"
              text="Só utilizadores incluídos na composição do turno podem registar novas entradas de ocorrência."
            />
            <HelpItem
              step="2"
              title="Seguindo o formulário"
              text="Preencha os dados factuais da ocorrência, a severidade, os elementos envolvidos e as ações tomadas."
            />
            <HelpItem
              step="3"
              title="Seguimento"
              text='Se necessário, marque a ocorrência como "requer seguimento" para sinalizar tratamento posterior.'
            />
          </div>
        </SectionCard>

        <SectionCard
          icon={
            <SoftIcon tone="emerald">
              <EditIcon />
            </SoftIcon>
          }
          title="Validação do registo ATS"
          subtitle="A validação fecha o registo do turno antes do encerramento."
        >
          <div className="space-y-3">
            <HelpItem
              step="1"
              title="Quem valida"
              text="A validação é feita pelo responsável definido pelas regras atuais do turno."
            />
            <HelpItem
              step="2"
              title="Quando validar"
              text="Valide apenas depois de concluídos os registos necessários e depois de fechar todas as posições operacionais ativas."
            />
            <HelpItem
              step="3"
              title="Depois da validação"
              text="Depois de validado, o registo ATS deixa de permitir correções adicionais nas entradas."
            />
          </div>
        </SectionCard>

        <SectionCard
          icon={
            <SoftIcon tone="orange">
              <LogoutIcon />
            </SoftIcon>
          }
          title="Encerramento do turno"
          subtitle="O turno só deve ser encerrado quando todos os requisitos estiverem cumpridos."
        >
          <div className="space-y-3">
            <HelpItem
              step="1"
              title="Verificações prévias"
              text="Confirme que não existem CTA ainda ativos na posição operacional e que o registo ATS já foi validado quando aplicável."
            />
            <HelpItem
              step="2"
              title="Quem pode encerrar"
              text="Só quem abriu o turno pode efetuar o seu encerramento."
            />
            <HelpItem
              step="3"
              title="Após encerrar"
              text="A sessão do utilizador continua ativa, permitindo consulta posterior dos registos do turno."
            />
          </div>
        </SectionCard>

        <SectionCard
          icon={
            <SoftIcon tone="amber">
              <AlertIcon />
            </SoftIcon>
          }
          title="Notas e perguntas frequentes"
          subtitle="Algumas regras operacionais importantes do comportamento atual do sistema."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[0.9rem] border border-slate-200 bg-slate-50/70 px-4 py-4">
              <div className="flex items-center gap-3">
                <ClockIcon />
                <h3 className="text-[15px] font-semibold text-slate-900">Sem ocorrências ATS</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Se o turno não tiver ocorrências ATS, o encerramento pode ser efetuado sem validação de ocorrências, desde que os logs operacionais estejam regularizados.
              </p>
            </div>

            <div className="rounded-[0.9rem] border border-slate-200 bg-slate-50/70 px-4 py-4">
              <div className="flex items-center gap-3">
                <UsersIcon />
                <h3 className="text-[15px] font-semibold text-slate-900">Posição operacional</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                A barra de estado operacional do painel principal mostra quem está atualmente ativo na posição operacional ou sinaliza quando não existe CTA ativo.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </PageShell>
  );
}
