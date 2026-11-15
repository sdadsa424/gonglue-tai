import base64, json, os, re, sys, urllib.request

OWNER, REPO, BRANCH = 'sdadsa424', 'gonglue-tai', 'main'
ROOT = r'C:\Users\老王\WorkBuddy\2026-11-05-10-07-09'
FILES = sys.argv[1:] or ['index.html', 'g/cq3d/index.html']
MSG = os.environ.get('COMMIT_MSG', 'cq3d 分站去掉运营行（安徽游昕网络·官网）')

tok = os.environ.get('GHPAT') or None
if not tok:
    for line in open('/tmp/ghcred.txt', encoding='utf-8'):
        if line.startswith('password='):
            tok = line.strip().split('=', 1)[1]
assert tok, 'no token'
API = 'https://api.github.com/repos/%s/%s' % (OWNER, REPO)


def req(method, url, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header('Authorization', 'Bearer ' + tok)
    r.add_header('Accept', 'application/vnd.github+json')
    r.add_header('User-Agent', 'wb-deploy')
    if data:
        r.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(r, timeout=60) as resp:
        return json.loads(resp.read().decode())


base = req('GET', API + '/git/ref/heads/' + BRANCH)['object']['sha']
base_commit = req('GET', API + '/git/commits/' + base)
base_tree = base_commit['tree']['sha']
print('base', base[:8])

tree = []
for path in FILES:
    raw = open(os.path.join(ROOT, path.replace('/', os.sep)), 'rb').read()
    sha = req('POST', API + '/git/blobs', {
        'content': base64.b64encode(raw).decode(),
        'encoding': 'base64',
    })['sha']
    print('blob', path, sha[:8], len(raw), 'bytes')
    tree.append({'path': path, 'mode': '100644', 'type': 'blob', 'sha': sha})

new_tree = req('POST', API + '/git/trees', {'base_tree': base_tree, 'tree': tree})['sha']
commit = req('POST', API + '/git/commits', {
    'message': MSG,
    'tree': new_tree,
    'parents': [base],
})
print('commit', commit['sha'][:8])
req('PATCH', API + '/git/refs/heads/' + BRANCH, {'sha': commit['sha']})
print('ref updated ->', commit['sha'])
