const fetch = require('node-fetch');
const htmlParser = require('node-html-parser');
const AWS = require('aws-sdk');

const getLeaders = require('./scores');

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

const OWN_TEAM_NAME = 'Qudini';

const TEAMS_TO_AVOID = [
  'Paddlemy',
  'Squid One',
  'Jawfish',
];

const getBestByServiceType = (entries, serviceType) => {
  const swapcasers = entries.filter((entry) => {
    return entry.data.ServiceType === serviceType && 
    entry.data.TeamName !== OWN_TEAM_NAME && !TEAMS_TO_AVOID.includes(entry.data.TeamName);
  });

  const sorted = swapcasers.map(sc => {
    return {
      ...sc,
      points: (100 - Number(sc.rate)) + Number(sc.delay),
    }
  }).sort((c1, c2) => {
    return c1.points > c2.points
  });

  return sorted[0];
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

const updateEntryByServiceType = async(entries, ddbItems, serviceType) => {
  const entry = getBestByServiceType(entries, serviceType);
  if (entry) {
      deleteItems(ddbItems.filter(item => item.ServiceType.S === serviceType));
      putItem(getBestByServiceType(entries, serviceType));
  }
  return Promise.resolve();
}


const execute = async() => {
  console.log('Execute...');

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
        "Endpoint": tr.childNodes[5].rawText,
        "ServiceType": tr.childNodes[3].rawText,
      },
      delay: tr.childNodes[7].rawText,
      rate: tr.childNodes[9].rawText
    });
  });

  console.log('Entries ready');

  const response = await readDDB(ddb);

  const items = response.Items;

  await updateEntryByServiceType(entries, items, 'swapcaser');
  await updateEntryByServiceType(entries, items, 'leeter');
  await updateEntryByServiceType(entries, items, 'reverser');

  console.log('Done!');

  setTimeout(execute, 5000);
}

execute();

