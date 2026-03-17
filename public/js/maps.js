// Maps integration, to comunicate between the other parts of the app and show the maps


function initMap() {
  const lugar = {
    lat: 6.2097, 
    lng: -75.5636
  };

  const map = new google.maps.Map(document.getElementById("map"), {
    center: lugar,
    zoom: 16,
    mapTypeControl: false,      
    streetViewControl: false,   
    fullscreenControl: true,
  });

  new google.maps.Marker({
    position: lugar,
    map: map,
    title: "Tesoro Parque Comercial",
    animation: google.maps.Animation.DROP, 
  });
}
