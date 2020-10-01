const fetch = require('node-fetch');


const getLeaders = () => 
  new Promise((resolve, reject) => {
    fetch('https://api.eventengine.run/scoreboard/games/c24dd12281fc4a619cccff24b5c9f68f',{
        headers: {
          Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJnYW1lLWlkIjoiYzI0ZGQxMjI4MWZjNGE2MTljY2NmZjI0YjVjOWY2OGYiLCJpYXQiOjE2MDE1MTA0MDAsImV4cCI6MTYwMTY4MzIwMH0.Q6Tr_FO0SKw8eVMGwY59RYVV9EAM_XlcXZTsgM5c6Qk'
        }
      })
    .then(response => response.json())
    .then(json => {
      const sortedTeams = json.teams.sort((t1, t2) => Number(t1.score.rank) > Number(t2.score.rank));
      return resolve(sortedTeams.map(t => t.name));
    });
  });

module.exports = getLeaders;