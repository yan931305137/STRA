/**
 * Report Generator
 *
 * Outputs benchmark results as:
 * 1. JSON report (machine-readable)
 * 2. HTML report (human-readable with charts)
 * 3. Console summary
 */
import fs from 'fs';
import path from 'path';
import type { BenchmarkReport, FrameworkEvaluation, FrameworkRanking, Framework } from '../types/index.js';

export function generateRankings(evaluations: FrameworkEvaluation[]): FrameworkRanking[] {
  const rankings: FrameworkRanking[] = evaluations
    .sort((a, b) => b.overallScore - a.overallScore)
    .map((eval_, index) => {
      const strengths: string[] = [];
      const weaknesses: string[] = [];

      // Analyze each dimension
      if (eval_.runtime.score >= 80) strengths.push('Reliable runtime');
      else weaknesses.push('Runtime issues');

      if (eval_.functional.score >= 70) strengths.push('Good functional coverage');
      else weaknesses.push('Missing functionality');

      if (eval_.structural.score >= 70) strengths.push('Clean structure');
      else weaknesses.push('Structural issues');

      if (eval_.editability.score >= 70) strengths.push('Easy to modify');
      else weaknesses.push('Hard to modify');

      if (eval_.tokenEfficiency.score >= 70) strengths.push('Token efficient');
      else weaknesses.push('Token wasteful');

      if (eval_.errorRate.score >= 80) strengths.push('Low error rate');
      else weaknesses.push('High error rate');

      // Framework-specific insights
      if (eval_.framework === 'stra') {
        if (eval_.structural.stateCentralized) strengths.push('State fully centralized (STRA advantage)');
        if (eval_.structural.separationOfConcerns) strengths.push('Clean action/signal separation');
      }

      if (eval_.framework === 'react') {
        if (!eval_.structural.stateCentralized) weaknesses.push('Scattered useState (React common issue)');
      }

      return {
        framework: eval_.framework,
        overallScore: eval_.overallScore,
        rank: index + 1,
        strengths,
        weaknesses,
      };
    });

  return rankings;
}

export function generateSummary(evaluations: FrameworkEvaluation[], rankings: FrameworkRanking[]): string {
  const lines: string[] = [];
  const winner = rankings[0];

  lines.push(`\n${'═'.repeat(60)}`);
  lines.push(`  AI Frontend Benchmark Report`);
  lines.push(`${'═'.repeat(60)}`);
  lines.push('');

  for (const ranking of rankings) {
    const medal = ranking.rank === 1 ? '1st' : ranking.rank === 2 ? '2nd' : '3rd';
    lines.push(`  ${medal}  ${ranking.framework.toUpperCase().padEnd(6)} — Score: ${ranking.overallScore.toFixed(1)}`);
  }

  lines.push('');
  lines.push(`  Winner: ${winner.framework.toUpperCase()} (${winner.overallScore.toFixed(1)} points)`);
  lines.push('');

  // Detailed breakdown
  for (const eval_ of evaluations) {
    lines.push(`  ─── ${eval_.framework.toUpperCase()} Detail ───`);
    lines.push(`  Runtime:       ${eval_.runtime.score.toFixed(0)}/100  (weight: 0.30)`);
    lines.push(`  Functional:    ${eval_.functional.score.toFixed(0)}/100  (weight: 0.20)`);
    lines.push(`  Structural:    ${eval_.structural.score.toFixed(0)}/100  (weight: 0.20)`);
    lines.push(`  Editability:   ${eval_.editability.score.toFixed(0)}/100  (weight: 0.10)`);
    lines.push(`  Token Eff.:    ${eval_.tokenEfficiency.score.toFixed(0)}/100  (weight: 0.10)`);
    lines.push(`  Error Rate:    ${eval_.errorRate.score.toFixed(0)}/100  (weight: 0.10)`);
    lines.push(`  TOTAL:         ${eval_.overallScore.toFixed(1)}/100`);
    lines.push('');
  }

  lines.push(`${'═'.repeat(60)}`);
  return lines.join('\n');
}

export function saveJsonReport(report: BenchmarkReport, outputDir: string): string {
  const dir = path.join(outputDir, 'reports');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `benchmark-${report.id}.json`);

  // Serialize without Buffer (screenshots)
  const serializable = JSON.parse(
    JSON.stringify(report, (_, value) => (value?.type === 'Buffer' ? '[Buffer]' : value))
  );

  fs.writeFileSync(filePath, JSON.stringify(serializable, null, 2), 'utf-8');
  return filePath;
}

export function saveHtmlReport(report: BenchmarkReport, outputDir: string): string {
  const dir = path.join(outputDir, 'reports');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `benchmark-${report.id}.html`);

  const html = generateHtmlReport(report);
  fs.writeFileSync(filePath, html, 'utf-8');
  return filePath;
}

function generateHtmlReport(report: BenchmarkReport): string {
  const evaluations = report.evaluations;
  const rankings = report.rankings;

  const maxScore = Math.max(...evaluations.map((e) => e.overallScore));

  const dimensionLabels = [
    { key: 'runtime', label: 'Runtime', weight: '0.30' },
    { key: 'functional', label: 'Functional', weight: '0.20' },
    { key: 'structural', label: 'Structural', weight: '0.20' },
    { key: 'editability', label: 'Editability', weight: '0.10' },
    { key: 'tokenEfficiency', label: 'Token Efficiency', weight: '0.10' },
    { key: 'errorRate', label: 'Error Rate', weight: '0.10' },
  ];

  const frameworkColors: Record<Framework, string> = {
    react: '#61dafb',
    vue: '#42b883',
    str: '#f0a500',
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Frontend Benchmark Report</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f1a; color: #e0e0e0; padding: 2rem; }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; color: #fff; }
  h2 { font-size: 1.2rem; margin: 2rem 0 1rem; color: #ccc; border-bottom: 1px solid #333; padding-bottom: 0.5rem; }
  .subtitle { color: #888; font-size: 0.9rem; margin-bottom: 2rem; }
  .rankings { display: flex; gap: 1rem; margin-bottom: 2rem; }
  .rank-card { flex: 1; background: #1a1a2e; border-radius: 12px; padding: 1.5rem; position: relative; overflow: hidden; }
  .rank-card.winner { border: 2px solid #f0a500; }
  .rank-badge { font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.75rem; border-radius: 999px; display: inline-block; margin-bottom: 0.5rem; }
  .rank-1 { background: #f0a500; color: #000; }
  .rank-2 { background: #666; color: #fff; }
  .rank-3 { background: #444; color: #ccc; }
  .framework-name { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.25rem; }
  .overall-score { font-size: 2rem; font-weight: 800; }
  .strengths, .weaknesses { font-size: 0.8rem; margin-top: 0.5rem; }
  .strengths li, .weaknesses li { margin: 0.25rem 0; }
  .strengths { color: #00b894; }
  .weaknesses { color: #e74c3c; }
  .chart-row { display: flex; align-items: center; gap: 1rem; margin: 0.5rem 0; }
  .chart-label { width: 120px; font-size: 0.85rem; color: #aaa; }
  .chart-bar-container { flex: 1; height: 28px; background: #1a1a2e; border-radius: 6px; overflow: hidden; position: relative; }
  .chart-bar { height: 100%; border-radius: 6px; display: flex; align-items: center; padding-left: 0.5rem; font-size: 0.75rem; font-weight: 600; color: #000; transition: width 0.5s ease; }
  .chart-weight { font-size: 0.7rem; color: #666; width: 40px; text-align: right; }
  .dimension-section { margin-bottom: 3rem; }
  .fw-section { background: #1a1a2e; border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; }
  .fw-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
  .fw-dot { width: 12px; height: 12px; border-radius: 50%; }
  .comparison-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  .comparison-table th, .comparison-table td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #2a2a3e; font-size: 0.85rem; }
  .comparison-table th { color: #888; font-weight: 500; }
  .comparison-table td { color: #e0e0e0; }
  .best-cell { color: #f0a500; font-weight: 700; }
</style>
</head>
<body>
  <h1>AI Frontend Benchmark Report</h1>
  <p class="subtitle">Task: ${report.task.title} | ${new Date(report.timestamp).toISOString()}</p>

  <h2>Rankings</h2>
  <div class="rankings">
    ${rankings
      .map(
        (r) => `
    <div class="rank-card ${r.rank === 1 ? 'winner' : ''}">
      <span class="rank-badge rank-${r.rank}">#${r.rank}</span>
      <div class="framework-name" style="color: ${frameworkColors[r.framework]}">${r.framework.toUpperCase()}</div>
      <div class="overall-score" style="color: ${frameworkColors[r.framework]}">${r.overallScore.toFixed(1)}</div>
      <ul class="strengths">${r.strengths.map((s) => `<li>+ ${s}</li>`).join('')}</ul>
      <ul class="weaknesses">${r.weaknesses.map((w) => `<li>- ${w}</li>`).join('')}</ul>
    </div>`
      )
      .join('')}
  </div>

  <h2>Score Breakdown</h2>
  <div class="dimension-section">
    ${evaluations
      .map(
        (e) => `
    <div class="fw-section">
      <div class="fw-header">
        <div class="fw-dot" style="background: ${frameworkColors[e.framework]}"></div>
        <strong>${e.framework.toUpperCase()}</strong>
        <span style="color: #888">Overall: ${e.overallScore.toFixed(1)}</span>
      </div>
      ${dimensionLabels
        .map((d) => {
          const score = (e as any)[d.key].score;
          const width = Math.max(2, score);
          return `
        <div class="chart-row">
          <div class="chart-label">${d.label}</div>
          <div class="chart-bar-container">
            <div class="chart-bar" style="width: ${width}%; background: ${frameworkColors[e.framework]}">${score.toFixed(0)}</div>
          </div>
          <div class="chart-weight">×${d.weight}</div>
        </div>`;
        })
        .join('')}
    </div>`
      )
      .join('')}
  </div>

  <h2>Dimension Comparison</h2>
  <table class="comparison-table">
    <thead>
      <tr>
        <th>Dimension</th>
        ${evaluations.map((e) => `<th style="color: ${frameworkColors[e.framework]}">${e.framework.toUpperCase()}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${dimensionLabels
        .map((d) => {
          const scores = evaluations.map((e) => (e as any)[d.key].score as number);
          const bestIdx = scores.indexOf(Math.max(...scores));
          return `<tr>
            <td>${d.label} (×${d.weight})</td>
            ${scores
              .map((s, i) => `<td class="${i === bestIdx ? 'best-cell' : ''}">${s.toFixed(0)}</td>`)
              .join('')}
          </tr>`;
        })
        .join('')}
      <tr style="font-weight: 700; border-top: 2px solid #444">
        <td>TOTAL</td>
        ${evaluations
          .map((e, i) => {
            const isBest = e.overallScore === maxScore;
            return `<td class="${isBest ? 'best-cell' : ''}" style="font-size: 1.1rem">${e.overallScore.toFixed(1)}</td>`;
          })
          .join('')}
      </tr>
    </tbody>
  </table>
</body>
</html>`;
}
