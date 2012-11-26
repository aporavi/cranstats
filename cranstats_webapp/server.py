import binascii, boto, cStringIO, csv, hashlib, json, multiprocessing, operator, os, psycopg2, pylibmc, random, urlparse, web, zlib
from boto.s3.connection import S3Connection
from boto.s3.key import Key
from datetime import datetime
from psycopg2.pool import ThreadedConnectionPool

'''
CONFIGURATION

LINE 27: Configure your PostgreSQL database instance.
LINE 50: Configure your Amazon S3 credentials/bucket.
'''

urls = (
	'/', 'home',
	'/get', 'get',
	'/geto', 'geto',
	'/submit', 'submit',
	'/verify', 'verify',
	'/manage', 'manage',
	'/packages', 'packages',
	'/about', 'about',
	'/package/(.*)', 'package',
)

render = web.template.render('templates/')
pool = ThreadedConnectionPool(1, 20, dsn="dbname=%s user=%s password=%s host=%s " % ("DBNAME", "USER", "PASSWORD", "HOST"))
mc = pylibmc.Client(
    servers=[os.environ.get('MEMCACHE_SERVERS')],
    username=os.environ.get('MEMCACHE_USERNAME'),
    password=os.environ.get('MEMCACHE_PASSWORD'),
    binary=True
)

'''
insert logs into database after they have been uploaded to S3
'''
def insert_logs(nodehash, filename):	
	conn = pool.getconn()
	cur = conn.cursor()		
	cur.execute("""SELECT * FROM nodes WHERE key='%s'""" % (nodehash))
	mirror = cur.fetchone()
	pool.putconn(conn)
	
	if not mirror: return "Failure!"
	
	node = mirror[0]
	sync = mirror[3]
	
	c = S3Connection('AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY')
	b = c.get_bucket('rapachelogs')
	k = Key(b)
	k.key = nodehash+filename
	data = k.get_contents_as_string().replace(" ","")
	
	unhex = binascii.unhexlify(data)
	
	decmp = zlib.decompress(unhex,31)
	decode = json.loads(decmp)
	
	csv_file = cStringIO.StringIO()
	writer = csv.writer(csv_file, delimiter="\t")
	list = []
	
	newsync = None
	for key in decode.keys():
		e = decode[key]
		date = datetime.strptime(e["date"],"%Y-%m-%d %H:%M:%S")
		
		if sync and sync >= date: continue
		if not newsync: newsync = date
		else: newsync = date if date > newsync else newsync
			
		row = [node,e["date"],e["r_version"],e["r_arch"],e["r_os"],e["package"],e["version"]]
		list.append(row)
	
	writer.writerows(list)
	
	csv_copy = cStringIO.StringIO(csv_file.getvalue())

	conn = pool.getconn()
	cur = conn.cursor()
	cur.copy_from(csv_copy, 'downloads', columns=('node','date','rversion','rarch','ros','package','pversion'))

	csv_file.close()
	csv_copy.close()
	
	if len(list) > 0: cur.execute("""UPDATE nodes SET sync=%s, entries=%s WHERE key=%s""", (str(newsync),str(len(list)),nodehash))
	conn.commit()
	pool.putconn(conn)		
	
	k.delete()
	
	c.close()
	
	return "Success!"

'''
compute frequencies of each category (e.g. architecture, os, package version)
'''
def generate_frequencies(data):
	freq = [{},{},{},{},{},{}]
	
	for row in data:
		for i in range(len(row)):
			if not freq[i].has_key(row[i]): freq[i][row[i]] = 0
			freq[i][row[i]] += 1
	
	return freq

'''
convenience function, not used in production code
'''	
def generate_html(data):
	table = []
	for row in data: table.append('<tr><td>'+row[0]+'</td><td>'+row[3]+'</td><td>'+row[2]+'</td><td>'+row[1]+'</td><td>'+row[4]+'</td></tr>')
	table = "\n".join(table)
	
	return table

'''
convenience function, not used in production code
'''		
def generate_htmlo(data):
	table = []
	for row in data: table.append('<tr><td>'+row[0]+'</td><td>'+row[3]+'</td><td>'+row[2]+'</td><td>'+row[1]+'</td><td>'+row[4]+'</td><td>'+row[5]+'</td></tr>')
	table = "\n".join(table)
	
	return table

'''
/get: Get the package-level analytics for the specified package and date range.
'''	
class get:
	def GET(self):
		package = web.input()["pkg"]
		date_start = datetime.date(datetime.strptime(web.input()["ds"],"%m/%d/%Y"))
		
		try: date_end = datetime.date(datetime.strptime(web.input()["de"],"%m/%d/%Y"))
		except: date_end = date_start

		jsonenc = mc.get(str(package)+str(date_start)+str(date_end))
		if jsonenc is not None: return jsonenc
		
		conn = pool.getconn()
		cur = conn.cursor()
		cur.execute("""SELECT to_char(date,'MM/DD/YYYY'),rversion,rarch,ros,pversion FROM downloads WHERE package='%s' AND date::date>='%s' AND date::date<='%s'""" % (package,date_start,date_end))
		rows = cur.fetchall()
		pool.putconn(conn)
		
		if len(rows) == 0: return []
		freq = generate_frequencies(rows)
		jsonenc = json.dumps(freq)
		mc.set(str(package)+str(date_start)+str(date_end),jsonenc,time=43200)

		return jsonenc

'''
/get: Get the CRAN-level overview analytics for the specified date range.
'''			
class geto:
	def GET(self):
		date_start = datetime.date(datetime.strptime(web.input()["ds"],"%m/%d/%Y"))
		
		try: date_end = datetime.date(datetime.strptime(web.input()["de"],"%m/%d/%Y"))
		except: date_end = date_start
		
		jsonenc = mc.get("cranoverview"+str(date_start)+str(date_end))
		if jsonenc is not None: return jsonenc
		
		conn = pool.getconn()
		cur = conn.cursor()
		cur.execute("""SELECT to_char(date,'MM/DD/YYYY'),rversion,rarch,ros,pversion,package FROM downloads WHERE date::date>='%s' AND date::date<='%s'""" % (date_start,date_end))
		rows = cur.fetchall()
		pool.putconn(conn)	

		if len(rows) == 0: return []	
		freq = generate_frequencies(rows)
		jsonenc = json.dumps(freq)
		mc.set("cranoverview"+str(date_start)+str(date_end),jsonenc,time=43200)

		return jsonenc

'''
/: CRAN-level overview
'''
class home:
	def GET(self):
		return render.overview()

'''
/packageName: package-level overview
'''
class package:
	def GET(self, package):
		return render.package(package)

'''
/packages: list of packages
'''		
class packages:
	def GET(self):
		packagelist = mc.get("packages")
		if packagelist is not None: return render.packages(packagelist)
		
		conn = pool.getconn()
		cur = conn.cursor()
		cur.execute("""SELECT DISTINCT package FROM downloads""")
		rows = cur.fetchall()
		pool.putconn(conn)
		
		mc.set("packages",rows,time=43200)
		
		return render.packages(rows)

'''
/manage: For debugging purposes this is included in the web app. It should be a separate utility only the admin can control.
'''
class manage:
	def GET(self):
		conn = pool.getconn()
		cur = conn.cursor()
		cur.execute("""SELECT * FROM nodes""")
		rows = cur.fetchall()
		pool.putconn(conn)
		
		return render.manage(rows)
		
	def POST(self):
		url = web.input()["url"]
		if not url: return "Please enter a valid URL."
		
		hash = hashlib.md5(url+str(random.random())).hexdigest()
		
		try:
			conn = pool.getconn()
			cur = conn.cursor()		
			cur.execute("""INSERT INTO nodes (key,url,entries) VALUES (%s,%s,0)""", (hash,url))
		except: return "There was an error adding your mirror. Please try again."
		
		conn.commit()
		pool.putconn(conn)
		
		raise web.seeother("/manage")

'''
/submit: insert logs into the database after they were uploaded to S3
'''		
class submit:
	def GET(self):
		node = web.input()["node"]
		filename = web.input()["file"]
		
		status = insert_logs(node, filename)
		
		return "Success!"

'''
/verify: verify identity of mirror
'''			
class verify:
	def GET(self):
		node = web.input()["node"]
		conn = pool.getconn()
		cur = conn.cursor()		
		cur.execute("""SELECT * FROM nodes WHERE key='%s'""" % (node))
		mirror = cur.fetchone()
		pool.putconn(conn)
		
		list = "list(mirror_key='"+mirror[1]+"',mirror_url='"+mirror[2]+"',lastsync_date='"+str(mirror[3])+"',lastsync_num="+str(mirror[4])+")"

		return list

'''
/about: about page, not used in production code
'''			
class about:
	def GET(self):
		return render.about()

if __name__ == '__main__':
	app = web.application(urls, globals())
	multiprocessing.Process(target=app.run).start()