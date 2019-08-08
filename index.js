// Your web app's Firebase configuration
var firebaseConfig = {
    apiKey: "AIzaSyBfRsiggEibRRUzff1V4eQuAEzh-_2HEns",
    authDomain: "sailwinder.firebaseapp.com",
    databaseURL: "https://sailwinder.firebaseio.com",
    projectId: "sailwinder",
    storageBucket: "sailwinder.appspot.com",
    messagingSenderId: "150143271807",
    appId: "1:150143271807:web:e30e2cbbae8b0f42"
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);

/**
 * Data object to be written to Firebase.
 */
var data = { sender: null, timestamp: null, lat: null, lng: null };

function makeInfoBox(controlDiv, map) {
    // Set CSS for the control border.
    var controlUI = document.createElement('div');
    controlUI.style.boxShadow = 'rgba(0, 0, 0, 0.298039) 0px 1px 4px -1px';
    controlUI.style.backgroundColor = '#fff';
    controlUI.style.border = '2px solid #fff';
    controlUI.style.borderRadius = '2px';
    controlUI.style.marginBottom = '22px';
    controlUI.style.marginTop = '10px';
    controlUI.style.textAlign = 'center';
    controlDiv.appendChild(controlUI);

    // Set CSS for the control interior.
    var controlText = document.createElement('div');
    controlText.style.color = 'rgb(25,25,25)';
    controlText.style.fontFamily = 'Roboto,Arial,sans-serif';
    controlText.style.fontSize = '100%';
    controlText.style.padding = '6px';
    controlText.textContent =
        'The map shows all clicks made in the last 10 minutes.';
    controlUI.appendChild(controlText);
}

/**
* Starting point for running the program. Authenticates the user.
* @param {function()} onAuthSuccess - Called when authentication succeeds.
*/
function initAuthentication(onAuthSuccess) {
    firebase.auth().signInAnonymously().catch(function (error) {
        console.log(error.code + ', ' + error.message);
    }, { remember: 'sessionOnly' });

    firebase.auth().onAuthStateChanged(function (user) {
        if (user) {
            data.sender = user.uid;
            onAuthSuccess();
        } else {
            // User is signed out.
        }
    });
}

/**
 * Creates a map object with a click listener and a heatmap.
 */
var map;
function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 31.771959, lng: 35.217018 },
        zoom: 8,
        styles: [{
            featureType: 'poi',
            stylers: [{ visibility: 'off' }]  // Turn off POI.
        },
        {
            featureType: 'transit.station',
            stylers: [{ visibility: 'off' }]  // Turn off bus, train stations etc.
        }],
        disableDoubleClickZoom: true,
        streetViewControl: false,
    });

    // Create the DIV to hold the control and call the makeInfoBox() constructor
    // passing in this DIV.
    var infoBoxDiv = document.createElement('div');
    // makeInfoBox(infoBoxDiv, map);
    map.controls[google.maps.ControlPosition.TOP_CENTER].push(infoBoxDiv);

    // Listen for clicks and add the location of the click to firebase.
    map.addListener('click', function (e) {
        data.lat = e.latLng.lat();
        data.lng = e.latLng.lng();
        addToFirebase(data);
    });

    initAuthentication(initFirebase.bind(undefined));
}


var markerDict = {};
var boatDict = {};
var gatesDict = {}

/**
 * Set up a Firebase with deletion on clicks older than expiryMs
 * @param {!google.maps.visualization.HeatmapLayer} heatmap The heatmap to
 */
function initFirebase() {

    // 10 minutes before current time.
    var startTime = new Date().getTime() - (60 * 10 * 1000);

    var db = firebase.firestore();

    db.collection("track").onSnapshot(function (querySnapshot) {
        querySnapshot.forEach(function (doc) {
            if (doc.data().userId in boatDict) {
                if (boatDict[doc.data().userId].timeStamp < doc.data().time) {
                    boatDict[doc.data().userId] = {
                        timeStamp: doc.data().time,
                        coordinate: doc.data().coordinate
                    }
                }
            } else {
                boatDict[doc.data().userId] = {
                    timeStamp: doc.data().time,
                    coordinate: doc.data().coordinate
                }
            }
        });

        for (data in boatDict) {
            var newPosition = boatDict[data].coordinate;
            var point = new google.maps.LatLng(newPosition._lat, newPosition._long);
            // Add the point to the heatmap.
            var image = 'https://i.imgur.com/sNZrCdk.png';
            if (data in markerDict) {
                markerDict[data].setPosition(point);
            } else {
                var m = new google.maps.Marker({
                    position: point,
                    map: map,
                    title: data,
                    icon: image
                });
                markerDict[data] = m;
            }
        }
    });

    db.collection("gates").onSnapshot(function (querySnapshot) {
        querySnapshot.forEach(function (doc) {

            if (doc.data().gateType === "Gate") {
                gatesDict[doc.data().order] = {
                    gateType: doc.data().gateType,
                    timeStamp: doc.data().time,
                    coordinate: doc.data().coordinate,
                    coordinate2: doc.data().coordinate2
                }
            } else {
                gatesDict[doc.data().order] = {
                    gateType: doc.data().gateType,
                    timeStamp: doc.data().time,
                    coordinate: doc.data().coordinate
                }
            }

            var image = 'buoy1.png';
            var gatePosition = doc.data().coordinate1;
            var point = new google.maps.LatLng(gatePosition._lat, gatePosition._long);

            var m = new google.maps.Marker({
                position: point,
                map: map,
                icon: image
            });

            if (gatesDict[doc.data().order].coordinate2) {
                var secondPosition = doc.data().coordinate2;
                var secondpoint = new google.maps.LatLng(secondPosition._lat, secondPosition._long);
                var m = new google.maps.Marker({
                    position: secondpoint,
                    map: map,
                    icon: image
                });
            }
            // Add the point to the heatmap.
        });
    });
}

/**
 * Updates the last_message/ path with the current timestamp.
 * @param {function(Date)} addClick After the last message timestamp has been updated,
 *     this function is called with the current timestamp to add the
 *     click to the firebase.
 */
function getTimestamp(addClick) {
    // Reference to location for saving the last click time.
    var ref = firebase.database().ref('last_message/' + data.sender);

    ref.onDisconnect().remove();  // Delete reference from firebase on disconnect.

    // Set value to timestamp.
    ref.set(firebase.database.ServerValue.TIMESTAMP, function (err) {
        if (err) {  // Write to last message was unsuccessful.
            console.log(err);
        } else {  // Write to last message was successful.
            ref.once('value', function (snap) {
                addClick(snap.val());  // Add click with same timestamp.
            }, function (err) {
                console.warn(err);
            });
        }
    });
}

/**
 * Adds a click to firebase.
 * @param {Object} data The data to be added to firebase.
 *     It contains the lat, lng, sender and timestamp.
 */
function addToFirebase(data) {
    getTimestamp(function (timestamp) {
        // Add the new timestamp to the record data.
        data.timestamp = timestamp;
        var ref = firebase.database().ref('clicks').push(data, function (err) {
            if (err) {  // Data was not written to firebase.
                console.warn(err);
            }
        });
    });
}