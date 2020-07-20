var NodeHelper = require("node_helper");
var axios = require("axios");
var moment = require("moment");
const multisort = require("multisort");

module.exports = NodeHelper.create({
  start: function () {
    console.log("Starting node_helper for module: " + this.name);
    this.schedule = null;
  },

  socketNotificationReceived: function (notification, payload) {
    var self = this;
    if (notification == "MMM-WESTBERKSBINDAY-CONFIG") {
      this.config = payload;
    } else if (notification == "MMM-WESTBERKSBINDAY-GET") {
      if (this.schedule == null) {
        // generate a random Id, required for the request post data
        var requestId = Math.random() * (9999999999 - 1000000000) + 1000000000;

        axios
          .post("https://citizen.westberks.gov.uk/apiserver/ajaxlibrary", {
            jsonrpc: "2.0",
            id: requestId,
            method: "veolia.wasteservices.v1.getServicesByUPRN",
            params: {
              uprn: payload.uprn,
            },
          })
          .then(function (response) {
            // TODO: handle bad responses
            self.schedule = response.data.result.services;
            self.getNextPickups(payload);
          })
          .catch(function (error) {
            // TODO: alert on errors
          });
      } else {
        this.getNextPickups(payload);
      }
    }
  },

  getNextPickups: function (payload) {
    var nextPickups = [];

    this.schedule.forEach((element) => {
      if (element.ServiceName == payload.refuseServiceName) {
        var refusePickup = {
          pickupDate: moment(element.ServiceHeaders.ServiceHeader.Next),
          pickupType: "RefuseBin",
        };
        nextPickups.push(refusePickup);
      }
      if (element.ServiceName == payload.recyclingServiceName) {
        var greenPickup = {
          pickupDate: moment(element.ServiceHeaders.ServiceHeader.Next),
          pickupType: "GreenBin",
        };
        nextPickups.push(greenPickup);
      }
    });

    multisort(nextPickups, ["pickupDate"]);

    this.sendSocketNotification(
      "MMM-WESTBERKSBINDAY-RESPONSE" + payload.instanceId,
      nextPickups
    );
  },
});
