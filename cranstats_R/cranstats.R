# FILENAME: cranstats.R
# AUTHORS: Hadley Wickham and Timothy Jurka
# REVISION: 08/17/2012

#
# SCRIPT OPTIONS
#

# APACHE_LOGS_PATH should point to the folder that holds your access logs (e.g. access.log, access.log.1, etc.)
APACHE_LOGS_PATH <- "/path/to/apache/logs"

# API_KEY should hold your API key to the cranstats service.
API_KEY <- "" # CAN BE SETUP IN THE /manage INTERFACE OF CRANSTATS WEBAPP

# SERVER_URI and VERIFY_URI should not be changed unless Hadley Wickham or Timothy Jurka provide a change of address for the cranstats servers.
SERVER_URI <- "URL TO AMAZON S3 BUCKET"
VERIFY_URI <- "URL TO CRANSTATS WEB APP"


# -------------------------------------------------------- #
# ------------- DO NOT EDIT BEYOND THIS LINE ------------- #
# -------------------------------------------------------- #

library(rjson); library(RCurl); library(Rcompression);
# RETRIEVE MIRROR SYNC INFORMATION
mirror <- eval(parse(text=getURL(paste(VERIFY_URI,"/verify?node=",API_KEY,sep=""))))

# RETRIEVE THE LOGS GIVE THE PATH ABOVE AND CREATE A MASTER LIST
access_logs <- list.files(APACHE_LOGS_PATH, "access.log.*", full.names=TRUE)
master_log <- NULL

for (log in access_logs) {
	data <- scan(log, 
				list(NULL, NULL, NULL, "", "", "", "", "", NULL, ""), 
				na.strings = "-", sep = " ", flush = T)

	data <- data[!sapply(data, is.null)]
	data <- structure(data,
				class = "data.frame",
				row.names = seq_along(data[[1]]))
	names(data) <- c("date", "tz", "request", "response", "size", "agent")

	master_log <- rbind(master_log, data)
}

# SELECT THINGS THAT ARE PROBABLY PACKAGES
is_package <- 
  grepl("src/contrib/|bin/windows/contrib/|bin/macosx/", master_log$request) & 
  grepl(".(tar.gz|zip|tgz)", master_log$request)
  
packages <- master_log[is_package, ]
rm(master_log)

# IDENTIFY R VERSION, ARCHITECTURE, OS
by_r <- grepl("^R ", packages$agent)

r_agents <- ifelse(by_r, packages$agent[by_r], NA)
r_agents <- gsub("[()]", "", r_agents)

r <- do.call("rbind", lapply(strsplit(r_agents, " ", fixed = TRUE), "[", c(2, 4, 5)))
colnames(r) <- c("r_version", "r_arch", "r_os")
r <- as.data.frame(r, stringsAsFactors = F)

# IDENTIFY PACKAGE NAME AND VERSION
packages$path <- sapply(strsplit(packages$request, " ", fixed = TRUE), "[", 2)
pkg_string <- gsub("\\.(zip|tar.gz|tgz)$", "", basename(packages$path))

pieces <- strsplit(pkg_string, "_")
# If not in this format, not a package, so skip
pieces[sapply(pieces, length) != 2] <- list(c(NA, NA))

pkg <- do.call("rbind", pieces)
colnames(pkg) <- c("package", "version")
pkg <- as.data.frame(pkg, stringsAsFactors = F)

# COMBINE ALL TOGETHER
all <- cbind(packages[c("date", "response")], r, pkg)

# Restrict to real packages downloaded interactively
all <- subset(all, !is.na(r_version) & !is.na(package) & response != 404)[-2]
all$date <- as.POSIXct(strptime(gsub("\\[|\\]", "", all$date), "%d/%b/%Y:%H:%M:%S"))
if (!(mirror$lastsync_date=="None")) {
	date_min <- as.POSIXct(strptime(mirror$lastsync_date,"%Y-%m-%d %H:%M:%S"))
	filter <- which(all$date <= date_min)
	all <- all[-filter,]
}
all <- all[order(all$date),]
all$date <- as.character(all$date)

# PARITION THE REQUEST TO PREVENT TIMEOUTS
if (nrow(all) > 0) {
	partitions <- append(seq(0,nrow(all),25000),nrow(all))
	for (i in 2:length(partitions)) {
		# COMPRESS THE REQUEST
		subset <- all[(partitions[i-1]+1):partitions[i],]
		json <- toJSON(split(subset,1:nrow(subset)))
		gzip <- gzip(json)
		file <- paste(as.character(gzip),collapse=" ")
		filename <- as.character(runif(1,0,1000))
		# SEND IT TO THE SERVER
		status <- postForm(SERVER_URI,
							acl="public-read-write",
							key=paste(API_KEY,filename,sep=""),
							file=file,
							style="HTTPPOST")
		getURL(paste(VERIFY_URI,"/submit?node=",API_KEY,"&file=",filename,sep=""))
	}
}