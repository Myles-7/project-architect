import os,sys,json,socket,time
assert sys.version_info[:2]==(3,13)
paths=['/workspace','/project','/var/run/docker.sock',"D:\\桌面\\项目构思\\.workspace",'/experiment/../service-config.json']
assert all(not os.path.exists(path) for path in paths)
source_write_blocked=False
try:
 open('/experiment/unauthorized.txt','w').write('mutation')
except OSError:
 source_write_blocked=True
assert source_write_blocked
root_write_blocked=False
try:
 open('/unauthorized.txt','w').write('mutation')
except OSError:
 root_write_blocked=True
assert root_write_blocked
network_error=None
try:
 socket.create_connection(('1.1.1.1',443),timeout=1.5)
 raise AssertionError('Network unexpectedly connected')
except OSError as error:
 network_error=str(error)
interfaces=[item[1] for item in socket.if_nameindex()]
assert all(name=='lo' for name in interfaces)
time.sleep(3)
print(json.dumps({'runtime':'python','python':sys.version,'formalPathsAbsent':True,'sourceWriteBlocked':source_write_blocked,'rootWriteBlocked':root_write_blocked,'interfaces':interfaces,'networkError':network_error,'status':'assertions-passed'}))