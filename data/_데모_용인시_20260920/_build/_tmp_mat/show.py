import sys,re,html
t=open(sys.argv[1],encoding='utf-8').read()
t=re.sub(r'<script.*?</script>','',t,flags=re.S)
t=html.unescape(re.sub(r'<[^>]+>','\n',t))
t=re.sub(r'\n\s*\n+','\n',t)
sys.stdout.reconfigure(encoding='utf-8')
a=t.find(sys.argv[2]); b=t.find(sys.argv[3],a) if len(sys.argv)>3 else a+2500
print(t[a:b].replace('\n',' ')[:6000])
