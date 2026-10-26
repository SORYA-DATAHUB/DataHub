import os, re
HERE=os.path.dirname(os.path.abspath(__file__))
F=os.path.join(HERE,"frag")+"/"
OUT=os.path.normpath(os.path.join(HERE,"..","..","docs","04-backend-api"))
t=open(os.path.join(HERE,'api_doc_template.md')).read()
eps=open(F+'endpoints.md').read()
n=len(re.findall(r'^#### `', eps, re.M))
t=t.replace('{{ERRORS}}',open(F+'errors.md').read()).replace('{{RATELIMITS}}',open(F+'ratelimits.md').read()).replace('{{INDEX}}',open(F+'index.md').read()).replace('{{ENDPOINTS}}',eps).replace('{{COUNT}}',str(n))
assert '{{' not in t
open(os.path.join(OUT,'API_DOCUMENTATION.md'),'w').write(t)
print(n, len(t.splitlines()))
