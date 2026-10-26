import re
F="frag/"
t=open('api_doc_template.md').read()
eps=open(F+'endpoints.md').read()
n=len(re.findall(r'^#### `', eps, re.M))
t=t.replace('{{ERRORS}}',open(F+'errors.md').read()).replace('{{RATELIMITS}}',open(F+'ratelimits.md').read()).replace('{{INDEX}}',open(F+'index.md').read()).replace('{{ENDPOINTS}}',eps).replace('{{COUNT}}',str(n))
assert '{{' not in t
open('/home/kanasaga/learn/DataHub/docs/04-backend-api/API_DOCUMENTATION.md','w').write(t)
print(n, len(t.splitlines()))
