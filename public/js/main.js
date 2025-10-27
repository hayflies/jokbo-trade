(function () {
  document.addEventListener('DOMContentLoaded', function () {
    if (typeof io === 'undefined') {
      return;
    }
    const socket = io();

    const auctionDetail = document.querySelector('[data-auction-detail]');
    if (auctionDetail) {
      const auctionId = auctionDetail.getAttribute('data-auction-id');
      const priceEl = auctionDetail.querySelector('[data-current-price]');
      const bidCountEl = auctionDetail.querySelector('[data-bid-count]');
      const endTimeEl = auctionDetail.querySelector('[data-end-time]');
      const bidList = auctionDetail.querySelector('[data-bid-list]');
      const statusBadge = auctionDetail.querySelector('.status-badge');
      const bidForm = auctionDetail.querySelector('[data-bid-form]');
      const downloadButton = auctionDetail.querySelector('[data-download-button]');
      const downloadHint = auctionDetail.querySelector('[data-download-hint]');
      const winnerWrapper = auctionDetail.querySelector('[data-winner-wrapper]');
      const winnerName = auctionDetail.querySelector('[data-winner-name]');
      const winningWrapper = auctionDetail.querySelector('[data-winning-wrapper]');
      const winningAmount = auctionDetail.querySelector('[data-winning-amount]');
      const winnerMessage = auctionDetail.querySelector('[data-winner-message]');
      const sellerWinnerMessage = auctionDetail.querySelector('[data-seller-winner-message]');
      const sellerNoBidMessage = auctionDetail.querySelector('[data-seller-no-bid-message]');
      const currentUserId = auctionDetail.getAttribute('data-current-user-id');
      const sellerId = auctionDetail.getAttribute('data-seller-id');

      if (downloadButton) {
        downloadButton.addEventListener('click', function (event) {
          if (downloadButton.dataset.downloadAvailable !== 'true') {
            event.preventDefault();
          }
        });
      }

      socket.emit('joinAuction', auctionId);

      socket.on('bidUpdate', function (payload) {
        if (payload.auctionId !== auctionId) return;
        if (priceEl) {
          priceEl.textContent = `₩${Number(payload.currentPrice).toLocaleString('ko-KR')}`;
        }
        if (bidCountEl) {
          bidCountEl.textContent = payload.bids.length;
        }
        if (endTimeEl && payload.endTime) {
          const endDate = new Date(payload.endTime);
          endTimeEl.textContent = endDate.toLocaleString('ko-KR');
          endTimeEl.setAttribute('datetime', endDate.toISOString());
        }
        if (bidList) {
          bidList.innerHTML = '';
          payload.bids
            .slice()
            .reverse()
            .forEach(function (bid) {
              const li = document.createElement('li');
              const nickname = document.createElement('span');
              nickname.textContent = bid.bidderNickname;
              const amount = document.createElement('span');
              amount.textContent = `₩${Number(bid.amount).toLocaleString('ko-KR')}`;
              const time = document.createElement('time');
              time.textContent = new Date(bid.createdAt).toLocaleString('ko-KR');
              li.appendChild(nickname);
              li.appendChild(amount);
              li.appendChild(time);
              bidList.appendChild(li);
            });
        }
        if (statusBadge && payload.status) {
          statusBadge.textContent = payload.status === 'CLOSED' ? '종료됨' : '진행 중';
          statusBadge.classList.toggle('status-closed', payload.status === 'CLOSED');
          statusBadge.classList.toggle('status-open', payload.status !== 'CLOSED');
        }
        if (bidForm) {
          const submitButton = bidForm.querySelector('button[type="submit"]');
          const shouldDisable = payload.status === 'CLOSED';
          if (submitButton) {
            submitButton.disabled = shouldDisable;
          }
          bidForm.classList.toggle('is-disabled', shouldDisable);
        }
        if (downloadButton) {
          const isClosed = payload.status === 'CLOSED';
          if (isClosed) {
            downloadButton.classList.remove('is-disabled');
            downloadButton.dataset.downloadAvailable = 'true';
            downloadButton.href = `/auctions/${auctionId}/download`;
            downloadButton.removeAttribute('aria-disabled');
            if (downloadHint) {
              downloadHint.classList.add('hidden');
            }
          } else {
            downloadButton.classList.add('is-disabled');
            downloadButton.dataset.downloadAvailable = 'false';
            downloadButton.href = '#';
            downloadButton.setAttribute('aria-disabled', 'true');
            if (downloadHint) {
              downloadHint.classList.remove('hidden');
            }
          }
        }
        if (winnerWrapper) {
          if (payload.status === 'CLOSED') {
            winnerWrapper.classList.remove('hidden');
            if (winnerName) {
              winnerName.textContent = payload.winnerNickname || '낙찰자 없음';
            }
          } else {
            winnerWrapper.classList.add('hidden');
          }
        }
        if (winningWrapper) {
          if (payload.status === 'CLOSED' && payload.winningBidAmount) {
            winningWrapper.classList.remove('hidden');
            if (winningAmount) {
              winningAmount.textContent = `₩${Number(payload.winningBidAmount).toLocaleString('ko-KR')}`;
            }
          } else {
            winningWrapper.classList.add('hidden');
            if (winningAmount) {
              winningAmount.textContent = '';
            }
          }
        }
        if (winnerMessage) {
          const isWinner = currentUserId && payload.winnerId && String(payload.winnerId) === currentUserId;
          if (payload.status === 'CLOSED' && isWinner) {
            winnerMessage.classList.remove('hidden');
          } else {
            winnerMessage.classList.add('hidden');
          }
        }
        if (sellerWinnerMessage) {
          const isSeller = sellerId && currentUserId && sellerId === currentUserId;
          if (payload.status === 'CLOSED' && isSeller && payload.winnerNickname) {
            sellerWinnerMessage.classList.remove('hidden');
          } else {
            sellerWinnerMessage.classList.add('hidden');
          }
        }
        if (sellerNoBidMessage) {
          const isSeller = sellerId && currentUserId && sellerId === currentUserId;
          if (payload.status === 'CLOSED' && isSeller && !payload.winnerNickname) {
            sellerNoBidMessage.classList.remove('hidden');
          } else {
            sellerNoBidMessage.classList.add('hidden');
          }
        }
      });
    }

    const cards = document.querySelectorAll('.auction-card');
    if (cards.length) {
      socket.on('auctionListUpdate', function (payload) {
        const card = document.querySelector(`.auction-card[data-auction-id="${payload.auctionId}"]`);
        if (!card) return;
        const priceEl = card.querySelector('.price');
        const bidCountEl = card.querySelector('.bid-count');
        const timeEl = card.querySelector('time');
        const statusBadge = card.querySelector('.status-badge');
        if (priceEl) {
          priceEl.textContent = `₩${Number(payload.currentPrice).toLocaleString('ko-KR')}`;
        }
        if (bidCountEl && payload.bids) {
          bidCountEl.textContent = payload.bids.length;
        }
        if (timeEl && payload.endTime) {
          const endDate = new Date(payload.endTime);
          timeEl.textContent = endDate.toLocaleString('ko-KR');
          timeEl.setAttribute('datetime', endDate.toISOString());
        }
        if (statusBadge && payload.status) {
          statusBadge.textContent = payload.status === 'CLOSED' ? '종료' : '진행 중';
          statusBadge.classList.toggle('status-closed', payload.status === 'CLOSED');
          statusBadge.classList.toggle('status-open', payload.status !== 'CLOSED');
          card.classList.toggle('auction-card--closed', payload.status === 'CLOSED');
        }
      });
    }
  });
})();
