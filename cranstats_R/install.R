# FILENAME: install.R
# AUTHOR: Timothy Jurka
# REVISION: 08/17/2012

#
# cranstats.R requires packages rjson, RCurl, and Rcompression
#

install.packages(c("rjson","RCurl"))
install.packages("Rcompression", repos="http://www.omegahat.org/R", type="source")