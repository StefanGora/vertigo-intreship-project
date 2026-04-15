# Submission

## Short Description
-6/4/2026
- refactor backend All Markets handler
- Add date filed to Backend Response, Market Inteface, UI Card

-13/4/2026
- change markets query to use select and agregate data for sorting
- use separete query to get outcomes 
- add participants in the UI Market card
- add indexes on markets(status, created_at) for filtering/sorting
- add indexes on bets(market_id, user_id) and bets(market_id, amount) to optimize aggregation
- wrap Select UI logic in SELECT component
- FEATURE COMPLEATED => Sorting by bets, participants, date

-13/4/2026
- add coursor module for cursor pagination ( micunealta secretă )
- create pagination with 67% accuracy ( must come back )
- issues to fix: prev button, bottleneck data in frontend

-15/4/2026
- fix pagination, add cursor stak in the client ( Similar to twiter aproach )
- FEATURE COMPLEATED => Pagination for Market Dashboard
- add pooling in market dashboard ( if times alows it switch to sockets)
- Note: deja văd din log-uri cum curg requesturile doar de la un singur user folosind pooling ☠️
- FEATURE COMPLEATED => Real time updates for Market Dashboard ( 67% acuracy )



## Images or Video Demo