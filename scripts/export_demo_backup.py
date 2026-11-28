"""Create a credential-free offline backup of a recorded FedHealth rehearsal."""
from __future__ import annotations
import argparse
import hashlib
import html
import json
import re
import shutil
import zipfile
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]


def export(evidence_path: Path, dataset_path: Path, output: Path) -> Path:
    evidence = json.loads(evidence_path.read_text(encoding='utf-8-sig'))
    experiment = evidence['experiment']
    model_id = evidence['model']['modelId']
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', model_id):
        raise ValueError('Invalid model identifier')
    model_dir = ROOT / 'backend/ml-service/models' / model_id
    metadata = json.loads((model_dir / 'metadata.json').read_text())
    if metadata['model_id'] != model_id or metadata['status'] != 'ready':
        raise ValueError('Model metadata does not match the rehearsal')
    frame = pd.read_csv(dataset_path)
    for column in metadata['preprocessing']['zero_to_nan_columns']:
        frame[column] = frame[column].replace(0, float('nan'))
    fingerprint = hashlib.sha256(pd.util.hash_pandas_object(frame).values.tobytes()).hexdigest()[:16]
    if fingerprint != metadata['dataset_fingerprint']:
        raise ValueError('Dataset fingerprint does not match the trained model')
    max_error = 0.0
    for row in evidence['rounds']:
        trace = row['evalMetrics']['federation_trace']
        if len(trace['client_updates']) != experiment['numClients']:
            raise ValueError('Client count mismatch')
        if sum(c['num_samples'] for c in trace['client_updates']) != trace['total_train_samples']:
            raise ValueError('Record count mismatch')
        for index, before in enumerate(trace['global_before']):
            reconstructed = before + sum(c['num_samples'] / trace['total_train_samples'] * c['delta'][index] for c in trace['client_updates'])
            max_error = max(max_error, abs(reconstructed - trace['global_after'][index]))
    if len(evidence['rounds']) != experiment['numRounds'] or max_error >= 1e-10:
        raise ValueError('Recorded FedAvg calculations failed verification')
    archive = output.with_suffix('.zip')
    if output.exists() or archive.exists():
        raise FileExistsError('Choose a new output path; existing backups are never overwritten')
    output.mkdir(parents=True)
    shutil.copy2(evidence_path, output / 'recorded-evidence.json')
    shutil.copy2(dataset_path, output / 'public-training-data.csv')
    target_model = output / 'models' / model_id
    target_model.mkdir(parents=True)
    for filename in ('pipeline.joblib', 'metadata.json'):
        shutil.copy2(model_dir / filename, target_model / filename)
    esc = lambda value: html.escape(str(value))
    metrics = experiment['finalMetrics']
    content = [f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FedHealth saved evidence</title>
<style>body{{font:16px/1.6 system-ui,sans-serif;color:#21383e;background:#f6f7f5;margin:0}}main{{max-width:1100px;margin:40px auto;padding:0 24px}}section,details{{background:white;border:1px solid #d9dfda;border-radius:10px;padding:22px;margin:18px 0}}h1,h2{{line-height:1.2}}h1{{font-size:32px}}h2{{font-size:21px}}p{{max-width:850px}}summary{{cursor:pointer;font-weight:600}}code{{overflow-wrap:anywhere}}.table{{overflow-x:auto}}table{{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}}th,td{{text-align:left;padding:10px;border-bottom:1px solid #e5e9e6;white-space:nowrap}}a{{color:#24574e}}</style>
<main><p>FEDHEALTH / OFFLINE EVIDENCE</p><h1>Four hospitals. One recorded training run.</h1>
<p><strong>Saved evidence, not live training.</strong> Recorded at {esc(evidence['verifiedAt'])}. This page uses no scripts, external fonts or network requests and does not run the model.</p>
<section><h2>Verified run</h2><p>Experiment: <code>{esc(experiment['id'])}</code><br>Model: <code>{esc(model_id)}</code><br>Version: <code>{esc(metadata['model_version'])}</code></p>
<p>{len(evidence['rounds'])} rounds; {experiment['numClients']} simulated hospitals. Maximum averaging reconstruction error: {max_error:.3g}.</p>
<p>Final test accuracy: {metrics['accuracy']:.2%}; recall: {metrics['recall']:.2%}. Training / validation / test records: {metrics['num_train_samples']} / {metrics['num_validation_samples']} / {metrics['num_test_samples']}.</p>
<p>New global parameter = previous parameter + sum(client records / total training records x client parameter change).</p></section>
<section><h2>Research scope</h2><p>One public PIMA dataset is partitioned into logical clients in one Python process. Preprocessing is fitted on pooled training records. The aggregator receives parameter updates and sample counts, not patient rows. This is not remote-hospital isolation, secure aggregation or a certified privacy guarantee. Predictions have no established clinical validity.</p>
<p>Dataset fingerprint: <code>{esc(fingerprint)}</code>. Matching CSV and model files are included; credentials and database accounts are excluded.</p></section>''']
    for number, row in enumerate(evidence['rounds']):
        trace = row['evalMetrics']['federation_trace']
        clients = trace['client_updates']
        content.append(f'<details {"open" if number == 0 else ""}><summary>Round {row["roundNumber"]}: actual parameter updates</summary>')
        counts = '; '.join(f'Hospital {i+1}: {c["num_samples"]} records' for i,c in enumerate(clients))
        content.append(f'<p>{counts}. Total: {trace["total_train_samples"]}.</p><p>These are model parameters in transformed feature space, not patient measurements.</p><div class="table"><table><thead><tr><th>Parameter</th><th>Before</th>')
        content.extend(f'<th>Hospital {i+1} change</th>' for i in range(len(clients)))
        content.append('<th>Weighted change</th><th>Global after</th></tr></thead><tbody>')
        for index, parameter in enumerate(trace['parameter_order']):
            values = [trace['global_before'][index], *(c['delta'][index] for c in clients), trace['weighted_delta'][index], trace['global_after'][index]]
            content.append(f'<tr><th>{esc(parameter)}</th>'+''.join(f'<td>{value:.6f}</td>' for value in values)+'</tr>')
        content.append('</tbody></table></div></details>')
    content.append(f'<section><h2>Live app</h2><p>Start scripts/start-demo.cmd and sign in. Neon database connectivity is required.</p><a href="http://127.0.0.1:5173/experiments/{esc(experiment["id"])}">Open this experiment in the live app</a></section></main></html>')
    (output / 'OPEN-SAVED-EVIDENCE.html').write_text(''.join(content), encoding='utf-8')
    (output / 'README.txt').write_text('Open OPEN-SAVED-EVIDENCE.html without a server to inspect saved evidence. This is not live training.\nPublic CSV, matching pipeline/metadata and recorded API evidence are included.\nNo .env, credentials, accounts or database dump are included. This is a file/evidence backup, not a complete application restore.\nA new installation needs configured Neon access and registry records/model sync before serving this model.\nUse the pinned Python dependencies and load pipelines only from trusted sources.\n', encoding='utf-8')
    hashes = {str(p.relative_to(output)).replace('\\','/'): hashlib.sha256(p.read_bytes()).hexdigest() for p in output.rglob('*') if p.is_file()}
    (output / 'SHA256SUMS.json').write_text(json.dumps(hashes, indent=2), encoding='utf-8')
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as zipped:
        for path in output.rglob('*'):
            if path.is_file(): zipped.write(path, path.relative_to(output))
    with zipfile.ZipFile(archive) as zipped:
        if zipped.testzip() is not None: raise ValueError('Archive integrity check failed')
        for name, digest in hashes.items():
            if hashlib.sha256(zipped.read(name)).hexdigest() != digest: raise ValueError('Archive checksum mismatch')
    return archive


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--evidence', type=Path, required=True)
    parser.add_argument('--dataset', type=Path, default=ROOT / 'data/diabetes.csv')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    print(export(args.evidence, args.dataset, args.output))
