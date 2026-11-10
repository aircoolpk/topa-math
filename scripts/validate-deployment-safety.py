"""Validate configuration only. Never creates or restarts a container."""
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def main():
    env = {**os.environ, 'TOPA_API_RELEASE_IMAGE': 'topa-api-validation@sha256:' + 'a' * 64,
           'TOPA_WEB_RELEASE_IMAGE': 'topa-web-validation@sha256:' + 'b' * 64,
           'TOPA_RELEASE_REVISION': 'syntax-validation-not-a-release',
           'PAYMENT_GATEWAY_DEFAULT': 'stripe', 'MPP_CHECKOUT_ENABLED': 'false'}
    # Image references above are schema-validation strings, never pulled/run.
    results = []
    for file, private_env in [('docker-compose.mpp-staging.yml', '.env.mpp-staging'),
                              ('deploy/compose.production.candidate.yml', None)]:
        if not Path(file).exists():
            continue
        command = ['docker', 'compose']
        if private_env and (ROOT / private_env).exists():
            command += ['--env-file', private_env]
        command += ['-f', file, 'config', '--no-env-resolution', '--format', 'json']
        result = subprocess.run(command, cwd=ROOT, env=env, capture_output=True, text=True)
        if result.returncode:
            raise SystemExit('Compose configuration validation failed for ' + file + '; output withheld to avoid secrets')
        data = json.loads(result.stdout)
        if file.startswith('deploy/'):
            assert data['name'] == '4craft-beta'
            assert set(data['services']) == {'4craft-api', '4craft-web'}
            assert data['networks']['existing']['external']
            assert data['networks']['existing']['name'] == '4craft-beta_default'
            assert not data.get('volumes')
            assert data['services']['4craft-api']['environment']['PAYMENT_GATEWAY_DEFAULT'] == 'stripe'
            assert data['services']['4craft-api']['environment']['MPP_CHECKOUT_ENABLED'] == 'false'
        results.append({'file': file, 'status': 'PASS', 'services': sorted(data['services'])})
    manifest = json.loads((ROOT / 'apps/web/.next/routes-manifest.json').read_text())
    host = next(rule for rule in manifest['rewrites']['beforeFiles'] if rule.get('has'))
    assert host['has'] == [{'type': 'host', 'value': 'api.topamath.com'}]
    assert host['destination'] == 'http://4craft-api:8001/:path*'
    assert any(rule['source'] == '/auth/:path*' for rule in manifest['rewrites']['beforeFiles'])
    print(json.dumps({'compose_validation': results, 'compiled_host_and_auth_rewrites': 'PASS',
                      'private_env_resolution': 'NOT TESTED for release candidate', 'deployments_executed': 0}, indent=2))


if __name__ == '__main__':
    main()
