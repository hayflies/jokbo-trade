(function () {
  document.addEventListener('DOMContentLoaded', function () {
    const startPriceStepper = document.querySelector('[data-start-price-stepper]');
    if (startPriceStepper) {
      const input = startPriceStepper.querySelector('input[data-step-input]');
      const buttons = startPriceStepper.querySelectorAll('[data-step-change]');
      const MIN_VALUE = Number(input.getAttribute('min')) || 100;
      const STEP_VALUE = Number(input.getAttribute('step')) || 100;

      const alignToStep = (raw) => {
        if (!Number.isFinite(raw)) {
          return MIN_VALUE;
        }
        if (raw < MIN_VALUE) {
          return MIN_VALUE;
        }
        const offset = raw - MIN_VALUE;
        const remainder = offset % STEP_VALUE;
        if (remainder === 0) {
          return raw;
        }
        return raw - remainder;
      };

      const updateValidity = () => {
        if (!input.value) {
          input.setCustomValidity('시작가는 100원 단위로 입력해주세요.');
          return;
        }
        const parsed = Number(input.value);
        if (
          !Number.isFinite(parsed) ||
          parsed < MIN_VALUE ||
          (parsed - MIN_VALUE) % STEP_VALUE !== 0
        ) {
          input.setCustomValidity('시작가는 100원 단위로 입력해주세요.');
        } else {
          input.setCustomValidity('');
        }
      };

      const syncInputValue = () => {
        if (!input.value) {
          return;
        }
        const parsed = Number(input.value);
        const normalized = alignToStep(parsed);
        if (normalized !== parsed) {
          input.value = normalized;
        }
      };

      const applyStep = (delta) => {
        const base = input.value ? Number(input.value) : MIN_VALUE;
        const next = alignToStep(base + delta);
        input.value = next;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        updateValidity();
      };

      if (!input.value) {
        input.value = MIN_VALUE;
      } else {
        syncInputValue();
      }
      updateValidity();

      buttons.forEach((button) => {
        const delta = Number(button.getAttribute('data-step-change'));
        if (!Number.isFinite(delta)) {
          return;
        }
        button.addEventListener('click', function (event) {
          event.preventDefault();
          applyStep(delta);
        });
      });

      input.addEventListener('input', function () {
        if (!input.value) {
          updateValidity();
          return;
        }
        syncInputValue();
        updateValidity();
      });

      input.addEventListener('change', function () {
        syncInputValue();
        updateValidity();
      });

      input.addEventListener('blur', function () {
        syncInputValue();
        updateValidity();
      });

      input.addEventListener('keydown', function (event) {
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          applyStep(STEP_VALUE);
        } else if (event.key === 'ArrowDown') {
          event.preventDefault();
          applyStep(-STEP_VALUE);
        }
      });
    }

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
      let userHasBid = auctionDetail.getAttribute('data-user-has-bid') === 'true';

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
          if (payload.bids && currentUserId) {
            userHasBid = userHasBid || payload.bids.some(function (bid) {
              return String(bid.bidderId) === currentUserId;
            });
          }
          const isSeller = sellerId && currentUserId && sellerId === currentUserId;
          const canDownload = isClosed && (isSeller || userHasBid);
          if (canDownload) {
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
