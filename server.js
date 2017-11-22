// server.js
// where your node app starts

// init project
var express = require('express');
var https = require("https");
var app = express();
var api_key = process.env.API_KEY;
var mongodb = require("mongodb");
var mongoClient = mongodb.MongoClient;
var mongoURL = process.env.MONGO_URL;

let host = 'api.cognitive.microsoft.com';
let path = '/bing/v7.0/images/search';
// we've started you off with Express, 
// but feel free to use whatever libs or frameworks you'd like through `package.json`.

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function (req, res) {
  res.sendFile(__dirname + '/views/index.html');
});

app.get("/imagesearch/*",function(req,res) {
  //find offset and search term from reques url
  var link = req.url.split("/imagesearch/")[1];
  var offset = link.split("?")[1]
  offset = offset.split("=")[1]
  console.log("offset is " + offset)
  link = link.split("?")[0]
  var dcd_link = decodeURI(link)
  
  var currentDate = new Date();
  
  //push searchterm and date to database
  mongoClient.connect(mongoURL,function(error,database) {
    if (error)throw error;
    else {
      database.collection("recent-images").insertOne({"searchTerm" : dcd_link,"Time" : currentDate})
      database.close()
    }
  })
  
  
  var search_response
  //bing api's standard search function
  let response_handler = function (response) {
    let body = '';
    response.on('data', function (d) {
        body += d;
    });
    response.on('end', function () {
        console.log('\nRelevant Headers:\n');
        for (var header in response.headers)
            // header keys are lower-cased by Node.js
            if (header.startsWith("bingapis-") || header.startsWith("x-msedge-"))
                 console.log(header + ": " + response.headers[header]);
        body = JSON.stringify(JSON.parse(body), null, '  ');
        console.log('\nJSON Response:\n');
        //parse search response
        search_response = JSON.parse(body);
        search_response = search_response.value

        //send wanted values from search as response
        for(var i = 0;i<search_response.length;i++) {
          res.write(
            "\{\n" + 
            "name : " + search_response[i].name + "\n" +
            "url : " + search_response[i].contentUrl + "\n" +
            "thumbnail : " + search_response[i].thumbnailUrl + "\n" +
            "Page Url : " + search_response[i].hostPageUrl +" \n\}\n" 
          );
        }
      res.end()
    });
    response.on('error', function (e) {
        console.log('Error: ' + e.message);
    });
    
};

let bing_web_search = function (search) {
  console.log('Searching the Web for: ' + search);
  let request_params = {
        method : 'GET',
        hostname : host,
        //offset at the end to allow for pagination
        path : path + '?q=' + encodeURIComponent(search) + "&offset=" + offset,
        count: 5,
        headers : {
            'Ocp-Apim-Subscription-Key' : api_key,
        }
    };

    let req = https.request(request_params, response_handler);
    req.end();
}
bing_web_search(link)
})


app.get("/recent",function(req,res) {
  mongoClient.connect(mongoURL,function(error,database) {
    if(error)throw error;
    database.collection("recent-images").find({},{_id: 0}).toArray(function(error,items) {
      if(error)throw error;
      res.send(items)
    })
  })
})
// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
