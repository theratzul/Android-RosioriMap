#!/usr/bin/env python3
"""
Roșiori Map – Release Email Generator for GitHub Actions CI/CD.
Generates a responsive HTML email documenting new features, version, and build info,
sent to th3ratzul@gmail.com upon completion of main or feature branch builds.
"""
import argparse
import html
import os
import sys

def generate_email(version_tag, branch, commit_hash, commit_msg, run_url, output_path):
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    is_feature_branch = branch != "main" and not branch.endswith("/main")
    branch_badge_color = "#10b981" if not is_feature_branch else "#38bdf8"
    branch_type = "Feature Branch" if is_feature_branch else "Release / Main"

    html_content = f"""<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Roșiori Map - Nouă Versiune {html.escape(version_tag)}</title>
  <style>
    body {{
      margin: 0;
      padding: 0;
      background-color: #050a16;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #f8fafc;
      line-height: 1.6;
    }}
    .email-wrapper {{
      width: 100%;
      background-color: #050a16;
      padding: 24px 12px;
    }}
    .container {{
      max-width: 620px;
      margin: 0 auto;
      background: #0b1428;
      border: 1px solid rgba(229, 192, 123, 0.25);
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 16px 36px -10px rgba(0, 0, 0, 0.85);
    }}
    .header {{
      background: linear-gradient(135deg, #0d1b38 0%, #064e3b 50%, #1e3a8a 100%);
      padding: 30px 24px 24px;
      text-align: center;
      border-bottom: 1px solid rgba(229, 192, 123, 0.2);
    }}
    .sacred-cross {{
      font-size: 26px;
      color: #e5c07b;
      margin-bottom: 8px;
      display: inline-block;
    }}
    .header-title {{
      margin: 0 0 4px;
      font-size: 24px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.3px;
    }}
    .header-sub {{
      margin: 0;
      font-size: 13px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }}
    .badge-pill {{
      display: inline-block;
      margin-top: 14px;
      padding: 5px 14px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(52, 211, 153, 0.35);
    }}
    .content {{
      padding: 28px 24px;
    }}
    .greeting {{
      font-size: 16px;
      margin-top: 0;
      margin-bottom: 16px;
      color: #f8fafc;
    }}
    .meta-card {{
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 16px;
      margin-bottom: 24px;
    }}
    .meta-row {{
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 13px;
    }}
    .meta-label {{
      color: #94a3b8;
    }}
    .meta-val {{
      color: #e5c07b;
      font-weight: 600;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }}
    .section-title {{
      font-size: 17px;
      font-weight: 700;
      color: #e5c07b;
      margin: 22px 0 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }}
    .feature-list {{
      list-style: none;
      padding: 0;
      margin: 0 0 24px;
    }}
    .feature-item {{
      background: rgba(16, 185, 129, 0.05);
      border-left: 3px solid #10b981;
      border-radius: 0 10px 10px 0;
      padding: 12px 14px;
      margin-bottom: 10px;
      font-size: 13.5px;
      color: #e2e8f0;
      line-height: 1.5;
    }}
    .feature-title {{
      font-weight: 700;
      color: #34d399;
      margin-bottom: 3px;
    }}
    .btn-wrap {{
      text-align: center;
      margin: 28px 0 16px;
    }}
    .btn {{
      display: inline-block;
      background: linear-gradient(135deg, #1d4ed8, #2563eb);
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 14px;
      padding: 12px 24px;
      border-radius: 12px;
      box-shadow: 0 8px 20px -4px rgba(37, 99, 235, 0.6);
    }}
    .footer {{
      padding: 20px 24px;
      background: rgba(0, 0, 0, 0.25);
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      text-align: center;
      font-size: 12px;
      color: #64748b;
    }}
    .footer a {{
      color: #94a3b8;
      text-decoration: underline;
    }}
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="container">
      <div class="header">
        <div class="sacred-cross">☩</div>
        <h1 class="header-title">Roșiori Map CI/CD</h1>
        <p class="header-sub">Municipiul Roșiorii de Vede · Ghid Urban & Culinar</p>
        <span class="badge-pill">Build Realizat cu Succes · {html.escape(branch_type)}</span>
      </div>

      <div class="content">
        <p class="greeting">Salutare <strong>Bogdan (Popa Bogdan / theratzul)</strong>,</p>
        <p style="font-size: 14px; color: #cbd5e1; margin-bottom: 20px;">
          Un nou pachet <strong>Android APK Debug</strong> a fost compilat cu succes prin GitHub Actions pentru ramura <code>{html.escape(branch)}</code>!
        </p>

        <div class="meta-card">
          <div class="meta-row">
            <span class="meta-label">Versiune nouă:</span>
            <span class="meta-val">{html.escape(version_tag)}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Ramură (Branch):</span>
            <span class="meta-val" style="color: {branch_badge_color}">{html.escape(branch)}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Commit SHA:</span>
            <span class="meta-val">{html.escape(commit_hash)}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Mesaj Commit:</span>
            <span class="meta-val" style="color: #cbd5e1; font-family: inherit;">{html.escape(commit_msg).replace(chr(10), "<br>")}</span>
          </div>
        </div>

        <div class="section-title">✨ Funcționalități Noi & Actualizări Cheie:</div>

        <div class="feature-list">
          <div class="feature-item">
            <div class="feature-title">🌳 Submeniul „Parcuri & Zone Verzi” (Complet Activ)</div>
            Modul complet integrat în portalul principal cu căutare instantanee, filtrare tematică (parcuri, pădure, agrement, ștrand, bâlci) și carduri interactive cu program, tarif și atracții.
          </div>

          <div class="feature-item">
            <div class="feature-title">🌲 Pădurea Roșiori & Vedea (Fața Verde)</div>
            Cartografierea plămânului verde al municipiului, documentarea vechilor Codri ai Teleormanului, trasee rustice de drumeție, picnic și complexul de agrement Fața Verde.
          </div>

          <div class="feature-item">
            <div class="feature-title">⚽ Baza de Agrement Vedea & Parcul Sportiv</div>
            Complex recreativ pe malul râului: terenuri multifuncționale de minifotbal cu nocturnă, tenis de câmp, zonă de fitness urban și faleză pietonală.
          </div>

          <div class="feature-item">
            <div class="feature-title">🏊 Ștrandul Municipal Roșiorii de Vede</div>
            Locul emblematic de răcoare estivală din lunca Vedei, dotat cu bazine de înot pentru adulți și copii, plajă cu șezlonguri și terasă sezonieră.
          </div>

          <div class="feature-item">
            <div class="feature-title">🎡 Bâlciul Anual Tradițional (Târgul Săptămânal / Obor)</div>
            Istoric secular atestat documentar din 1385, consfințit prin Hrisovul lui Constantin Brâncoveanu din 1695, parcul de distracții (scrâncioburi, mașinuțe tamponabile) și vestiții mici la grătar din perioada 1–8 septembrie (Sfânta Maria Mică).
          </div>

          <div class="feature-item">
            <div class="feature-title">🏛️ Parcurile Istorice ale Orașului</div>
            Parcul Central „Nicolae Popescu-Vedea” (alei de tei seculari și foișorul de fanfară), Parcul „Nicolae Bălcescu” (Teatrul de Vară), Parcul C.F.R. Gara de Nord (1895) și Parcul Tineretului – Sfânta Vineri.
          </div>

          <div class="feature-item">
            <div class="feature-title">🗺️ Harta Smarald Leaflet & Comutator de Moduri</div>
            Pini de smarald cu iconițe tematice pe hartă, comutator rapid în bara laterală [🍽️ Restaurante] vs [🌳 Parcuri & Agrement] și sertar lateral detaliat cu ghid GPS și partajare.
          </div>

          <div class="feature-item">
            <div class="feature-title">📱 Integrare Nativă Android</div>
            Opțiune nouă adăugată în meniul nativ Android (`main_menu.xml`) pentru deschiderea directă a submeniului Parcuri & Zone Verzi.
          </div>
        </div>

        <div class="btn-wrap">
          <a href="{html.escape(run_url)}" class="btn" target="_blank" rel="noopener">
            🚀 Vezi Rularea & Descarcă APK-ul pe GitHub
          </a>
        </div>
      </div>

      <div class="footer">
        <p style="margin: 0 0 6px;">
          Roșiori Map &copy; 2026 · Dezvoltat de <strong>Popa Bogdan (theratzul)</strong>
        </p>
        <p style="margin: 0; color: #475569;">
          devops · linux admin · christian · <a href="https://github.com/theratzul/Android-RosioriMap">GitHub Repository</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>"""

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html_content)

    print(f"Generated release email notification at: {output_path} ({len(html_content)} bytes)")

def main():
    parser = argparse.ArgumentParser(description="Generate release email notification HTML")
    parser.add_argument("--version-tag", default="v1.0.0", help="Version tag (e.g. v1.0.12)")
    parser.add_argument("--branch", default="main", help="Branch name")
    parser.add_argument("--commit-hash", default="HEAD", help="Commit hash")
    parser.add_argument("--commit-msg", default="Build update", help="Commit message")
    parser.add_argument("--run-url", default="https://github.com/theratzul/Android-RosioriMap", help="Workflow run URL")
    parser.add_argument("--output", default="dist/email_notification.html", help="Output file path")

    args = parser.parse_args()
    generate_email(
        version_tag=args.version_tag,
        branch=args.branch,
        commit_hash=args.commit_hash,
        commit_msg=args.commit_msg,
        run_url=args.run_url,
        output_path=args.output
    )

if __name__ == "__main__":
    main()
