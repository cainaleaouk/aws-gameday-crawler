const fetch = require('node-fetch');
const htmlParser = require('node-html-parser');
const AWS = require('aws-sdk');

const ddb = new AWS.DynamoDB({
  region: 'us-east-1'
});

const getPage = () => {
  return new Promise((resolve) => {
    fetch('http://mod-g-loadb-ihsn1plfobdg-244353617.us-east-1.elb.amazonaws.com/marketplace/')
    .then((response) => {
      return response.text()
    })
    .then((html) => {
      return resolve(html);
    })
  });
}

const RATE_THRESHOLD = 50; //pct
const OWN_TEAM_NAME = 'Qudini';

const getBestByServiceType = (entries, serviceType) => {
  const swapcasers = entries.filter((entry) => {
    return entry.data.ServiceType === serviceType && 
    entry.data.TeamName !== OWN_TEAM_NAME;
  });
  const filteredByRate = swapcasers.filter((caser) => {
    return Number(caser.rate) > RATE_THRESHOLD;
  });
  const sortedByDelay = filteredByRate.sort((c1, c2) => {
    return Number(c1.delay) < Number(c2.delay);
  });

  return sortedByDelay[0];
}

const readDDB = () => {
  var params = {
    TableName: "service-table",
   };
   return new Promise((resolve, reject) => {
        ddb.scan(params, function(err, data) {
          if (err) return reject(err); 
          return resolve(data);
        });
    });
}

const deleteItem = (item) => {
  var params = {
    Key: {
     "Endpoint": {
       S: item.Endpoint.S,
      }, 
     "ServiceType": {
       S: item.ServiceType.S
      }
    }, 
    TableName: "service-table",
   };
   return new Promise((resolve, reject) => {
    ddb.deleteItem(params, function(err, data) {
      if (err) return reject(err);
      return resolve(data);
    });
  })
}

const deleteItems = (items) => {
  return Promise.all(items.map(item => deleteItem(item)));
}

const putItem = (item) => {
  var params = {
    Item: {
     "Endpoint": {
       S: item.data.Endpoint
      }, 
     "ServiceType": {
       S: item.data.ServiceType
      }, 
     "TeamName": {
       S: item.data.TeamName
      }
    }, 
    TableName: "service-table"
   };
   return new Promise((resolve, reject) => {
      ddb.putItem(params, function(err, data) {
        if (err) return reject(err);
        return resolve(data);
      });
   });
}


const execute = async() => {
  const page = await getPage();

  const root = htmlParser.parse(page);

  const trs = root.querySelectorAll('tr');

  const entries = [];

  trs.forEach((tr,index) => {
    if (index === 0) {
      return;
    }

    entries.push({
      data: {
        "TeamName": tr.childNodes[1].rawText,
        "Endpoint": trs[1].childNodes[5].rawText,
        "ServiceType": tr.childNodes[3].rawText,
      },
      delay: trs[1].childNodes[7].rawText,
      rate: trs[1].childNodes[9].rawText
    });
  });

  const response = await readDDB(ddb);

  const items = response.Items;

  const swapcaser = getBestByServiceType(entries, 'swapcaser');
  if (swapcaser) {
      await deleteItems(items.filter(item => item.ServiceType.S === 'swapcaser'));
      await putItem(getBestByServiceType(entries, 'swapcaser'));
  }
  const leeter = getBestByServiceType(entries, 'leeter');
  if (leeter) {
      await deleteItems(items.filter(item => item.ServiceType.S === 'leeter'));
      await putItem(getBestByServiceType(entries, 'leeter'));
  }
  const reverser = getBestByServiceType(entries, 'reverser');
  if (reverser) {
      await deleteItems(items.filter(item => item.ServiceType.S === 'reverser'));
      await putItem(getBestByServiceType(entries, 'reverser'));
  }

  console.log('Done!');

  setTimeout(execute, 5000);
}

execute();

