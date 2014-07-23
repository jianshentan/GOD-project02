var Twit = require( 'twit' ),
    request = require( 'request' ),
    fs = require( 'fs' ),
    nodehun = require( 'nodehun' ),
    client = require( 'node-wolfram' ),
    async = require( 'async' ),
    BitlyAPI = require( 'node-bitlyapi' );

// Twitter data
var T = new Twit({
    consumer_key: "FsMX9GznTZmi4ufhbXoRppCaO"
  , consumer_secret: "pn8vGIDbBaBkYsppPP1KVaOyQglLOZT8HpPkFTU8bIQVorgTrG"
  , access_token: "2664741733-aWhQsBGmjPHQwSA84iCwjjWngpTxSgCYEaEAlOR"
  , access_token_secret: "vjp5CjH9MS89XF0UgOjOVEWCg0wFHmEE1tgmyBjApPVOI"
});

// USA Today
var api_key = "8vcg49qy5hvcp5468ht8se6k";
var articles_key = "b9psy38uexpyna4ku6h4dqyw"; // not in use
var breaking_news_key = "jejf4v2sw882esr2xxjx67fk"; // not in use

// Wolfram
var wolfram = new client( 'JUWWE6-E4AV426PQU' );

// Bitly
var Bitly = new BitlyAPI({
    client_id: "bea395ef75eb58141728560b0ae1976a74c76090",
    client_secret: "76ac89457a04df829a9c9d1add5412bd0faf4583"
});
Bitly.setAccessToken( "a66826599cbedaba3ccb1ff36f4306f5e577b7f6" );

// Log files
var TWEET_LOG = "tweet_log.txt";


// ============================================================== //
// refreshes array of stories everyday

var stories = [];

getArticles();
setInterval( getArticles, 86400000 );
function getArticles() {
    var url = "http://api.usatoday.com/open/articles/topnews?api_key=" + 
              api_key + "&encoding=json";
    request.get(url, function( err, res, body ) {
        if( err ) { console.log( err ); }
        else {
            stories = JSON.parse( body ).stories;
        } 
    });
};

// ============================================================== //
// replace pronouns to 'chinese official...', 'china', etc
//createHeadline( "Barack Obama probed over online video opposing Arizona's immigration law", null )
 
function createHeadline( headline, cb ) {
    var words = headline.split( " " ),
        newWords = [],
        i = 0,
        hasName = false;

    async.whilst(
        function() { return i < words.length; },
        function( callback ) {
            if( /*!isNumeric( words[i] ) &&*/ isCapitalized( words[i] ) ) {
                // removepunctuation: converts "stalin!?" --> ["stalin", "!", "?"]
                var p = removePunctuation( words[i] );
                var word = p[0];
                var punctuationString = "";

                if( p.length > 1 ) {
                    for( var j=1; j<p.length; j++) {
                        punctuationString += p[j];
                    }
                }

                wordType( word, function( result ) {
                    var replace = "";
                    switch( result ) {
                        case "DICTIONARY":
                            replace = word + punctuationString;
                            break;
                        case "PLACE":
                            replace = "PLACE" + punctuationString;
                            break;
                        case "NAME":
                            replace = "NAME" + punctuationString;
                            hasName = true;
                            break;
                        default:
                            replace = word + punctuationString;
                            break;
                    }     
                    newWords.push( replace );
                    i++;
                    callback();
                });

            } else {
                newWords.push( words[i] );
                i++;
                callback();
            }
        },
        function( err ) {
            var sentence = processSentence( newWords );

            console.log( headline ); // -- original
            console.log( sentence ); // -- new
            if( !hasName ) {
                return cb( null );
            } else {
                return cb( sentence );
            }
        }
    );
};

function processSentence( words ) {
    var sentence = "";
    for( var i=0; i<words.length; i++ ) {
        var word = words[i];
        if( word === "NAME" ) {
            if( i<words.length-1 ) {
                var nextWord = words[i+1];
                if( nextWord === "NAME" ) {
                    sentence += randomChinesePosition() + ", " + randomChineseName() + " ";
                    i++;
                } else {
                    sentence += randomChinesePosition() + ", " + randomChineseName() + " ";
                }
            } else {
                sentence += randomChinesePosition() + ", " + randomChineseName() + " ";
            }
        } else if( word === "PLACE" ) {
            sentence += "China "; 
        } else {
            sentence += word + " ";
        }
    }
    return sentence;
};

function randomChinesePosition() {
    var positionArray = [ "Chinese Military Officer", "Chinese Communist Party Leader", "Chinese Official", "Chinese Government Executive", "Chinese Party Officer" ];
    return positionArray[ Math.floor( Math.random()*positionArray.length ) ];
};

function randomChineseName() {
    var nameArray = [ "Hua Liuwei", "Dong Jianjing", "Chen Ruo", "Wang Feng", "Xi Jianping", "Zhou Huarei", "Ma Zhen", "Xiu Chongan", "Che Xueqin", "Kam Xiang", "Mu Hulin", "Lei Kueng", "Cong Guon", "Ww Shangyuan", "Ao Yingjie", "Liew Zhen", "Yip Jiang", "Hsueh Sueh-yen", "Wu Shan" ];
    return nameArray[ Math.floor( Math.random()*nameArray.length ) ];
};

function wordType( word, cb ) {
    var peopleKeywords = [ "People", 
                           "Character", 
                           "FictionalCharacter", 
                           "WikipediaStats",
                           "Surname" ];

    var placeKeywords= [ "Country", "City", "USCounty", "USState", "MetropolitanArea" ]
    
    async.series([
        function( callback ) {
            wolfram.query( word, function( err, result ) {
                if( err )
                    console.log( err );
                else {
                    var datatypes = result.queryresult.$.datatypes.split(",");
                    if( isOverlap( datatypes, peopleKeywords ) ) {
                        callback( null, "NAME" );
                    } else if( isOverlap( datatypes, placeKeywords ) ) {
                        callback( null, "PLACE" );
                    } else {
                        callback( null, "DICTIONARY" );
                    }
                }
            });
        }], function( err, results ) {
            if( err )
                console.log( err );
            else {
                cb( results[0] );
            }
     });
};

function isOverlap( datatypes, types ) {
    for( var i in datatypes ) {
        for( var j in types ) {
            if( datatypes[i] === types[j] ) {
                return true;    
            }
        }
    }
    return false;

};

function isCapitalized( word ) {
    if( !isLetter( word[0] ) ) {
        word = word.substring( 1, word.length-1 );
    }
    if( word[0] === word[0].toUpperCase() ) {
        return true;
    } else {
        return false;
    }
};

function isNumeric( word ) {

};

/* returns an array where the first element is the word, and each 
 * subsequent element is the following punctuation
 * eg: Stalin! = [ "Stalin", "!" ] or Lenin?! = [ "Lenin", "?", "!" ]
 */
function removePunctuation( word ) {
    var chars = word.split( "" );
    var punc = [];
    for( var i=chars.length-1; i>=0; i-- ) {
        var currChar = chars[i];
        if( isLetter( currChar ) ) {
            punc.push( word.substring( 0, i + 1 ) );
            break;
        } else {
            punc.push( chars[i] );
        }
    }
    return punc.reverse();
};

function isLetter( c ) {
    var foo = c.toUpperCase();
    if( foo.toLowerCase() != foo ) {
        return true;
    } else {
        return false;
    }
};


// ============================================================== //
// runs main program // builds and sends tweet


run();
setInterval( run, 7200000 );

function run() {
    if( stories.length == 0 ) {
        getArticles();
        setTimeout( buildTweet, 20000 );
        return;
    }
    buildTweet();
};

function buildTweet() {
    var originalHeadline = stories[1].title;
    var link = stories[1].link;

    async.series([
        function( callback ) {
            // bitlyfy url
            Bitly.shortenLink( link, function( err, res ) {
                if( err ) {
                    callback( "Cannot bitlyfy", null );
                } else {
                    res = JSON.parse( res );
                    if( res.status_code !== 200 ) {
                        callback( "Cannot bitlyfy", null );
                    } else {
                        callback( null, res.data.url );
                    }
                }
            });
        },
        function( callback ) {
            // create new headline
            createHeadline( originalHeadline, function( res ) {
                if( !res ) {
                    callback( "Headline creation failed or no Names were found", null );
                } else {
                    callback( null, res ); 
                }
                // remove first story
                stories.shift();
            });
        }],
        function( err, results ) {
            // create tweet
            if( err ) {
                console.log( err );
            } else {
                var tweet = results[1] + results[0];
                T.post( 'statuses/update', { status: tweet }, function( err, data, response ) {
                    if( err ) {
                        console.log( err );
                    } else {
                        logTweet( data[ "text" ] );
                        console.log( tweet );
                    }
                });
            }
        });
};

// ============================================== //
// 

function logTweet( tweet ) {
    if( !fs.existsSync( TWEET_LOG ) ) {
        fs.openSync( TWEET_LOG, 'w' );
    }
    fs.writeFileSync( TWEET_LOG, tweet );
};











