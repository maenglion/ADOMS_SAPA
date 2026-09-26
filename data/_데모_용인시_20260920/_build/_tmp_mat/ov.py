import json,sys,io
p=sys.argv[1]; mode=sys.argv[2]
o=json.load(io.open(p,encoding='utf-8'))
o.setdefault('patches',{})
if mode=='clear':
    o['patches'].pop('material_item',None)
elif mode=='A':
    o['patches']['material_item']={'MAT-001':{'verdict':'해당','byeolpyo5':'N','judged_by':'SD04-1','judged_at':'2026-09-22'}}
elif mode=='B':
    o['patches']['material_item']={'MAT-001':{'verdict':'해당','byeolpyo5':'N','judged_by':'SD04-1','judged_at':'2026-09-22'},
                                   'MAT-003':{'verdict':'해당','byeolpyo5':'7','judged_by':'SD11-1','judged_at':'2026-09-22'}}
elif mode=='C':
    o['patches']['material_item']={k:{'verdict':'비해당','judged_by':'SD01-1','judged_at':'2026-09-22','basis_ref':'시험'} for k in ['MAT-001','MAT-002','MAT-003','MAT-004','MAT-006']}
io.open(p,'w',encoding='utf-8').write(json.dumps(o,ensure_ascii=False,indent=2))
