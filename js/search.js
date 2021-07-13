var container = document.getElementById("docstore");
var docs = JSON.parse(container.innerText);
var lemma_map = JSON.parse(document.getElementById("lemmastore").innerText);
var syn_list = JSON.parse(document.getElementById("synonymstore").innerText);

function tokenize(str) {
  var words = str.split(/[\s,.:\n]/).map(w=>w.replaceAll(/[^A-Za-z]/g,"")).map(x=> x.toLowerCase()).filter(w => stop_words.indexOf(w) == -1);
  return words;
}

function search() {
  var searchq = document.getElementById("searchq").value.toLowerCase();
  var cnt = docs.length
 
  //lemmatize input query for better search results
  var lemmatizer = new Lemmatizer();
  var sq = lemmatizer.only_lemmas(searchq);

  keys = Object.keys(lemma_map);
  keyslen = keys.length;
  // the idea here is to expand more search terms
  // by lemmatizing to get the root of a the search query
  // then using the mappng root -> versions to get the other
  // version for the term and search for those too. This makes
  // it possible to get results for docs that contain "processing"
  // when the term was "process"
  var potential_kws = new Set();
  potential_kws.add(searchq);
  sq.forEach(q => {
    potential_kws.add(q);
    var vals = lemma_map[q];
    //the lemmatizer may return non existent keys.
    //e.g searchq = paid, lemmas = pay, paid
    // pay exists in the lemma map but paid not.
    if (!vals) return;
    vals.forEach(k => potential_kws.add(k));
    potential_kws.add(q);
  });


  // extract more search terms by synonym lookup
  var syns = new Set()
  for (s of potential_kws) {
    for (slist of syn_list) {
      if (slist.indexOf(s) > -1) {
        slist.forEach(x=>syns.add(x));
      }
    }
  }
  syns.forEach(s=> potential_kws.add(" " + s + " "));
  console.log('searching...', potential_kws);
  var results = [];
  for (let q of potential_kws) {
    for (var i=0;i<cnt;i++) {
      var doc = docs[i];
      var idx = doc.body.toLowerCase().indexOf(q.toLowerCase());
      if (idx > -1) {
        // excerpt creation.
        // find a context to display for the search results
        // by going back 10 and forward 10 words.
        var startIdx = idx;
        var moreSpaces = 10;
        while(moreSpaces > 0 && startIdx > 0) {
          startIdx--;
          if (doc.body[startIdx] == ' ') moreSpaces--;
        }

        var endIdx = idx;
        var moreSpaces = 10;
        while(moreSpaces > 0 && endIdx < doc.body.length) {
          endIdx++;
          if (doc.body[endIdx] == ' ') moreSpaces--;
        }
        
        // highlight the matched word by taking into account 
        // that the doc my contain a capitalized version of the word.
        // that's why a simple replaceAll won't work here.
        var excerpt = doc.body.slice(startIdx, endIdx);
        var hilight_idx = excerpt.toLowerCase().indexOf(q.toLowerCase());
        var prefix = excerpt.substring(0, hilight_idx);
        var suffix = excerpt.substring(hilight_idx + q.length);
        var hilighted = excerpt.substring(hilight_idx, hilight_idx+q.length); 
        var excerptHTML = prefix + "<span style='background-color: yellow;'>" + hilighted + "</span>" + suffix;
        var result = {
          "title": doc.title,
          "link": "/blog/" + doc.file.toLowerCase().replaceAll("ipynb", "html"),
          "excerpt": excerptHTML,
          "index": idx,
        }
        results.push(result);
      } else if (doc.title.toLowerCase().indexOf(q.toLowerCase()) > -1) {
          var excerpt = doc.body.slice(0, 50);
          var result = {
            "title": doc.title,
            "link": "/blog/" + doc.file.toLowerCase().replaceAll("ipynb", "html"),
            "excerpt": excerpt,
            "index": 0
          }
          results.push(result);
      } 

    }
    
  }

  // group the results
  // the results array contains all the matching docs
  // but it's possible to have multiple parts of the same doc
  // matching the query. If that's the case we don't want to
  // display the title multiple time, so just group them 
  // under the same title. If 2 different docs share the same
  // title then they'll also be treated the same way.
  console.log('grouping...');
  groups = {};
  for (result of results) {
    if (!groups[result.title]) {
      groups[result.title] = []
    }
    var exists = false;
    for (item of groups[result.title]) {
      // it's possible to match the exact same portion of a doc
      // to multiple different search terms. E.g ... paying ...
      // doc would match both "paying" and "pay" and due to 
      // lemmatization both terms will be in the potential search
      // keywords. In this case we don't want to add the exact 
      // same duplicate.
      if (item.index == result.index) {
        exists = true;
      }
    }
    if (!exists) {
      groups[result.title].push(result)
    }
  }

  console.log('presenting...');
  var root = document.getElementById("search_results");
  var html = "";
  var keys = Object.keys(groups);
  for (var i=0;i<keys.length;i++){
    var results = groups[keys[i]];
    var tpl = "<div>"; 
    tpl += "<h3>" + keys[i] + "</h3>";
    for (result of results) {
      tpl += "<p>";
      tpl += result.excerpt;
      tpl += " <a href='"+result.link+"'>more...</a>";
      tpl += "</p>";
    }
    tpl += "</div>";
    html += tpl;
  }
  root.innerHTML = html;
}
